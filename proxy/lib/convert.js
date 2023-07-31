/*
 * Copyright 2021 -  Universidad Politécnica de Madrid.
 *
 * This file is part of PEP-Proxy
 *
 */

//const config_service = require('./config_service');
//const config = config_service.get_config();
const debug = require('debug')('proxy:convert');
const got = require('got');
const StatusCodes = require('http-status-codes').StatusCodes;
const getReasonPhrase = require('http-status-codes').getReasonPhrase;
const _ = require('lodash');
const moment = require('moment-timezone');
const path = require('node:path');

const NGSI_LD_URN = 'urn:ngsi-ld:';
const TIMESTAMP_ATTRIBUTE = 'TimeInstant';
const DATETIME_DEFAULT = '1970-01-01T00:00:00.000Z';
const ATTRIBUTE_DEFAULT = null;
const { v4: uuidv4 } = require('uuid');

const createdAt = DATETIME_DEFAULT; //moment().tz('Etc/UTC').toISOString();
const modifiedAt = DATETIME_DEFAULT; //moment().tz('Etc/UTC').toISOString();

const JSON_LD_CONTEXT =
    process.env.CONTEXT_URL || 'https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld';

//(config.app.ssl ? 'https://' : 'http://') + config.app.host + ':' + config.app.port;
const template = require('handlebars').compile(
    `{
    "type": "{{type}}",
    "title": "{{title}}",
    "detail": "{{message}}"
  }`
);

const errorContentType = 'application/json';

/**
 * Determines if a value is of type float
 *
 * @param      {String}   value       Value to be analyzed
 * @return     {boolean}              True if float, False otherwise.
 */
function isFloat(value) {
    return !isNaN(value) && value.toString().indexOf('.') !== -1;
}

/**
 * Add the client IP of the proxy client to the list of X-forwarded-for headers.
 *
 * @param req - the incoming request
 * @return a string representation of the X-forwarded-for header
 */
function getClientIp(req) {
    let ip = req.ip;
    if (ip.substr(0, 7) === '::ffff:') {
        ip = ip.substr(7);
    }
    let forwardedIpsStr = req.header('x-forwarded-for');

    if (forwardedIpsStr) {
        // 'x-forwarded-for' header may return multiple IP addresses in
        // the format: "client IP, proxy 1 IP, proxy 2 IP" so take the
        // the first one
        forwardedIpsStr += ',' + ip;
    } else {
        forwardedIpsStr = String(ip);
    }

    return forwardedIpsStr;
}

/**
 * Amends an NGSIv2 attribute to NGSI-LD format
 * All native JSON types are respected and cast as Property values
 * Relationships must be give the type relationship
 *
 * @param      {String}   attr       Attribute to be analyzed
 * @return     {Object}              an object containing the attribute in NGSI-LD
 *                                   format
 */

function formatAttribute(attr, transformFlags = {}) {
    // eslint eqeqeq - deliberate double equals to include undefined.
    if (attr.value == null || Number.isNaN(attr.value)) {
        return undefined;
    }
    let obj = { type: 'Property', value: attr.value };

    switch (attr.type.toLowerCase()) {
        // Properties
        case 'property':
        case 'string':
        case 'text':
        case 'textunrestricted':
            break;

        // Other Native JSON Types
        case 'boolean':
            obj.value = !!attr.value;
            break;
        case 'float':
            if (isNaN(attr.value)) {
                obj = undefined;
            } else {
                obj.value = Number.parseFloat(attr.value);
            }
            break;
        case 'integer':
            if (isNaN(attr.value)) {
                obj = undefined;
            } else {
                obj.value = Number.parseInt(attr.value);
            }
            break;
        case 'number':
            if (isNaN(attr.value)) {
                obj = undefined;
            } else if (isFloat(attr.value)) {
                obj.value = Number.parseFloat(attr.value);
            } else {
                obj.value = Number.parseInt(attr.value);
            }
            break;

        // Temporal Properties
        case 'datetime':
            obj.value = {
                '@type': 'DateTime',
                '@value': moment.tz(attr.value, 'Etc/UTC').toISOString()
            };
            break;
        case 'date':
            obj.value = {
                '@type': 'Date',
                '@value': moment.tz(attr.value, 'Etc/UTC').format(moment.HTML5_FMT.DATE)
            };
            break;
        case 'time':
            obj.value = {
                '@type': 'Time',
                '@value': moment.tz(attr.value, 'Etc/UTC').format(moment.HTML5_FMT.TIME_SECONDS)
            };
            break;

        // GeoProperties
        case 'geoproperty':
        case 'point':
        case 'geo:point':
        case 'geo:json':
        case 'linestring':
        case 'geo:linestring':
        case 'polygon':
        case 'geo:polygon':
        case 'multipoint':
        case 'geo:multipoint':
        case 'multilinestring':
        case 'geo:multilinestring':
        case 'multipolygon':
        case 'geo:multipolygon':
            obj.type = 'GeoProperty';
            obj.value = attr.value;
            break;

        // Relationships
        case 'relationship':
            obj.type = 'Relationship';
            obj.object = attr.value;
            delete obj.value;
            break;

        // LanguageProperties
        case 'languageproperty':
            obj.type = 'LanguageProperty';
            obj.languageMap = attr.value;
            delete obj.value;
            break;

        default:
            obj.value = { '@type': attr.type, '@value': attr.value };
            break;
    }

    if (attr.metadata) {
        let timestamp;
        Object.keys(attr.metadata).forEach(function (key) {
            switch (key) {
                case TIMESTAMP_ATTRIBUTE:
                    timestamp = attr.metadata[key].value;
                    if (timestamp === ATTRIBUTE_DEFAULT || !moment(timestamp).isValid()) {
                        obj.observedAt = DATETIME_DEFAULT;
                    } else {
                        obj.observedAt = moment.tz(timestamp, 'Etc/UTC').toISOString();
                    }

                    break;
                case 'unitCode':
                    obj.unitCode = attr.metadata[key].value;
                    break;
                default:
                    obj[key] = formatAttribute(attr.metadata[key]);
            }
        });
        delete obj.TimeInstant;
    }

    if (transformFlags.sysAttrs) {
        obj.modifiedAt = obj.observedAt || modifiedAt;
        obj.createdAt = createdAt;
    }
    if (transformFlags.concise) {
        delete obj.type;
        if (obj.value && _.isEmpty(attr.metadata) && !transformFlags.sysAttrs) {
            obj = obj.value;
        }
    }

    delete obj.metadata;
    return obj;
}

function formatType(type) {
    let ldType = 'Property';

    switch (type.toLowerCase()) {
        case 'geoproperty':
        case 'point':
        case 'geo:point':
        case 'geo:json':
        case 'linestring':
        case 'geo:linestring':
        case 'polygon':
        case 'geo:polygon':
        case 'multipoint':
        case 'geo:multipoint':
        case 'multilinestring':
        case 'geo:multilinestring':
        case 'multipolygon':
        case 'geo:multipolygon':
            ldType = 'GeoProperty';
            break;
        case 'listproperty':
            ldType = 'ListProperty';
            break;
        case 'relationship':
            ldType = 'Relationship';
            break;
        case 'listrelationship':
            ldType = 'ListRelationship';
            break;
        case 'languageproperty':
            ldType = 'LanguageProperty';
            break;
        case 'vocabularyproperty':
            ldType = 'VocabularyProperty';
            break;
        default:
            ldType = 'Property';
            break;
    }
    return ldType;
}

/**
 * Return an "Internal Error" response. These should not occur
 * during standard operation
 *
 * @param res - the response to return
 * @param e - the error that occurred
 * @param component - the component that caused the error
 */
function internalError(res, e, component) {
    const message = e ? e.message : undefined;
    debug(`Error in ${component} communication `, message ? message : e);
    res.setHeader('Content-Type', errorContentType);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(
        template({
            type: 'urn:dx:as:InternalServerError',
            title: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR),
            message
        })
    );
}

/**
 * Amends an NGSIv2 payload to NGSI-LD format
 *
 * @param      {Object}   value       JSON to be converted
 * @return     {Object}               NGSI-LD payload
 */

function formatEntity(json, bodyIsJSONLD, transformFlags = {}) {
    const obj = {};
    if (bodyIsJSONLD) {
        obj['@context'] = JSON_LD_CONTEXT;
    }

    let id;
    Object.keys(json).forEach(function (key) {
        switch (key) {
            case 'id':
                id = json[key];
                obj[key] = id;
                if (!id.startsWith(NGSI_LD_URN)) {
                    obj[key] = NGSI_LD_URN + json.type + ':' + id;
                    debug('Amending id to a valid URN: %s', obj[key]);
                }
                break;
            case 'type':
                obj[key] = json[key];
                break;
            case TIMESTAMP_ATTRIBUTE:
                // Timestamp should not be added as a root
                // element for NSGI-LD.
                break;
            default:
                obj[key] = formatAttribute(json[key], transformFlags);
        }
    });

    delete obj.TimeInstant;
    return obj;
}

function formatSubscription(json, bodyIsJSONLD) {
    const condition = json.subject.condition || {};
    const expression = condition.expression || {};
    const notification = json.notification || {};

    const obj = {
        id: NGSI_LD_URN + 'Subscription:' + json.id,
        type: 'Subscription',
        description: json.description,
        entities: json.subject.entities,
        watchedAttributes: condition.attrs,
        q: expression.q,
        notification: {
            attributes: notification.attrs,
            format: notification.attrsFormat,
            endpoint: {
                uri: notification.httpCustom.headers.target,
                accept: 'application/json'
            }
        }
    };

    if (bodyIsJSONLD) {
        obj['@context'] = JSON_LD_CONTEXT;
    }
    return obj;
}

function formatEntityTypeList(json, bodyIsJSONLD) {
    const typeList = _.map(json, (type) => {
        return type.type;
    });

    const obj = {
        id: 'urn:ngsi-ld:EntityTypeList:' + uuidv4(),
        type: 'EntityTypeList',
        typeList
    };

    if (bodyIsJSONLD) {
        obj['@context'] = JSON_LD_CONTEXT;
    }
    return obj;
}

function formatEntityTypeInformation(json, bodyIsJSONLD, typeName) {
    const attributeDetails = [];

    _.forEach(json.attrs, (value, key) => {
        attributeDetails.push({
            id: key,
            type: 'Attribute',
            attributeName: key,
            attributeTypes: _.map(value.types, (type) => {
                return formatType(type);
            })
        });
    });

    const obj = {
        id: 'urn:ngsi-ld:EntityTypeInformation:' + uuidv4(),
        type: 'EntityTypeInformation',
        typeName: 'Building',
        entityCount: json.count,
        attributeDetails
    };

    if (bodyIsJSONLD) {
        obj['@context'] = JSON_LD_CONTEXT;
    }
    return obj;
}

function formatEntityAttributeList(json, bodyIsJSONLD) {
    const attributeList = [];

    _.map(json, (type) => {
        _.forEach(type.attrs, (value, key) => {
            attributeList.push(key);
        });
    });

    const obj = {
        id: 'urn:ngsi-ld:EntityAttributeList:' + uuidv4(),
        type: 'EntityAttributeList',
        attributeList: _.uniq(attributeList)
    };

    if (bodyIsJSONLD) {
        obj['@context'] = JSON_LD_CONTEXT;
    }
    return obj;
}

function formatEntityAttribute(json, bodyIsJSONLD, attributeName) {
    let attributeCount = 0;
    let attributeTypes = [];
    const typeNames = [];

    const filtered = _.filter(json, function (o) {
        return o.attrs[attributeName];
    });

    _.map(filtered, (type) => {
        attributeCount += type.count;
        typeNames.push(type.type);
        attributeTypes.push(type.attrs[attributeName].types);
    });

    attributeTypes = _.uniq(_.flatten(attributeTypes));

    const obj = {
        id: attributeName,
        type: 'Attribute',
        attributeCount,
        attributeTypes: _.map(attributeTypes, (type) => {
            return formatType(type);
        }),
        typeNames,
        attributeName
    };

    if (bodyIsJSONLD) {
        obj['@context'] = JSON_LD_CONTEXT;
    }
    return obj;
}

exports.getClientIp = getClientIp;
exports.formatAttribute = formatAttribute;
exports.formatEntity = formatEntity;
exports.formatSubscription = formatSubscription;
exports.formatEntityTypeList = formatEntityTypeList;
exports.formatEntityTypeInformation = formatEntityTypeInformation;
exports.formatEntityAttributeList = formatEntityAttributeList;
exports.formatEntityAttribute = formatEntityAttribute;
exports.internalError = internalError;
