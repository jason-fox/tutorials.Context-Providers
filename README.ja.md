[![FIWARE Banner](https://fiware.github.io/tutorials.LD-Subscriptions-Registrations/img/fiware.png)](https://www.fiware.org/developers)
[![NGSI v2](https://img.shields.io/badge/NGSI-v2-5dc0cf.svg)](https://fiware-ges.github.io/orion/api/v2/stable/)

[![FIWARE Core Context Management](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/core.svg)](https://github.com/FIWARE/catalogue/blob/master/core/README.md)
[![License: MIT](https://img.shields.io/github/license/fiware/tutorials.Relationships-Linked-Data.svg)](https://opensource.org/licenses/MIT)
[![Support badge](https://img.shields.io/badge/tag-fiware-orange.svg?logo=stackoverflow)](https://stackoverflow.com/questions/tagged/fiware)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.04.02_60/gs_cim009v010402p.pdf)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/) <br/>
[![Documentation](https://img.shields.io/readthedocs/fiware-tutorials.svg)](https://fiware-tutorials.rtfd.io)

このチュートリアルでは、NGSI-LD 内のサブスクリプションとレジストレーションの使用方法について説明し、NGSI-v2  と NGSI-LD
の同等操作の類似点と相違点を強調します。このチュートリアルは、元のコンテキスト・プロバイダとサブスクリプションの
チュートリアルに似ていますが、全体で **NGSI-LD** インターフェイスからの API 呼び出しを使用します。

このチュートリアルでは、全体で [cUrl](https://ec.haxx.se/) コマンドを使用していますが、
[Postmanドキュメント](https://fiware.github.io/tutorials.LD-Subscriptions-Registrations/) としても利用できます。

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/2c53b7c2bce9fd7b7b47)
[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/FIWARE/tutorials.LD-Subscriptions-Registrations/tree/NGSI-LD)

:warning:  **注:** このチュートリアルは、システムを **NGSI-LD** に切り替えたりアップグレードしたりする **NGSI-v2**
開発者向けに設計されています。リンクト・データシステムを最初から構築する場合、または **NGSI-v2** にまだ慣れていない場合は、
[NGSI-LD 開発者向けチュートリアル](https://www.letsfiware.jp/ngsi-ld-tutorials)のドキュメントを参照することをお勧めします。

## コンテンツ

<details>
<summary><strong>詳細</strong></summary>

-   [リンクト・データのサブスクリプションとレジストレーション](#understanding-linked-data-subscriptions-and-registrations)
    -   [在庫管理システム内のエンティティ](#entities-within-a-stock-management-system)
    -   [在庫管理フロントエンド](#stock-management-frontend)
-   [前提条件](#prerequisites)
    -   [Docker](#docker)
    -   [WSL](#wsl)
-   [アーキテクチャ](#architecture)
-   [起動](#start-up)
-   [コンポーネント間の相互作用](#interactions-between-components)
    -   [NGSI-LD でのサブスクリプションの使用](#using-subscriptions-with-ngsi-ld)
        -   [サブスクリプションを作成 (Store 1) - 低在庫](#create-a-subscription-store-1---low-stock)
        -   [サブスクリプションを作成 (Store 2) - 低在庫](#create-a-subscription-store-2---low-stock)
        -   [サブスクリプションの詳細を取得](#read-subscription-details)
        -   [サブスクリプション・イベントの取得](#retrieving-subscription-events)
    -   [NGSI-LD でのレジストレーションの使用](#using-registrations-with-ngsi-ld)
        -   [レジストレーションを作成](#create-a-registration)
        -   [レジストレーションの詳細を取得](#read-registration-details)
        -   [Store 1 から取得](#read-from-store-1)
        -   [コンテキスト・プロバイダから直接取得](#read-direct-from-the-context-provider)
        -   [コンテキスト・プロバイダの直接更新](#direct-update-of-the-context-provider)
        -   [フォワード更新 (Forwarded-update)](#forwarded-update)

</details>

<a name="understanding-linked-data-subscriptions-and-registrations"/>

# リンクト・データのサブスクリプションとレジストレーション

> “Do not repeat after me words that you do not understand. Do not merely put on a mask of my ideas, for it will be an
> illusion and you will thereby deceive yourself.”
>
> ― Jiddu Krishnamurti

NGSI-LD サブスクリプションとレジストレーションは、スマート・リンクト・データ・ソリューション内のコンポーネントが相互に
やり取りできるようにする基本的なメカニズムを提供します。

簡単な注意として、分散システム内では、サブスクリプションはサードパーティ・コンポーネントにコンテキスト・データの変更が
発生したことを通知し (コンポーネントはさらにアクションを実行する必要があります) 、レジストレーションは Context Broker
に別ソースからコンテキスト情報が利用可能であることを通知します。

これらの操作はどちらも、受信コンポーネントが受信したリクエストを完全に理解し、結果のペイロードを作成して解釈できることが
必要です。ここでの NGSI-v2 と NGSI-LD の操作の違いはわずかですが、リンクト・データの概念の組み込みを容易にするための
マイナーな修正が行われたため、さまざまなコンポーネント間の規約がマイナー・アップデートを含むように変更されました。

<a name="entities-within-a-stock-management-system"/>

## 在庫管理システム内のエンティティ

リンクト・データ・エンティティ間のリレーションシップは、次のように定義されています。既存のデータに加えて、`tweets` 属性は
コンテキスト・プロバイダ (_Context Provider_) によって提供されます。他のすべての点で、このモデルは
[以前のチュートリアル](https://github.com/FIWARE/tutorials.Working-with-Linked-Data/) と同じです。

![](https://fiware.github.io/tutorials.LD-Subscriptions-Registrations/img/entities.png)

<a name="stock-management-frontend"/>

## 在庫管理フロントエンド

シンプルな Node.js Express アプリケーションは、
[以前のチュートリアル](https://github.com/FIWARE/tutorials.Working-with-Linked-Data/) で NGSI-LD を使用するように更新
されました。モニタ・ページを使用して最近のリクエストのステータスを監視し、2つの Store  ページを使用して商品を購入します。
サービスが実行されると、これらのページには次の URL からアクセスできます :

#### イベント・モニタ

イベント・モニタは次の場所にあります: `http://localhost:3000/app/monitor`

![FIWARE Monitor](https://fiware.github.io/tutorials.LD-Subscriptions-Registrations/img/monitor.png)

#### Store 001

Store001 は次の場所にあります: `http:/localhost:3000/app/store/urn:ngsi-ld:Building:store001`

![Store](https://fiware.github.io/tutorials.LD-Subscriptions-Registrations/img/store.png)

#### Store 002

Store002 は次の場所にあります: `http:/localhost:3000/app/store/urn:ngsi-ld:Building:store002`

![Store2](https://fiware.github.io/tutorials.LD-Subscriptions-Registrations/img/store2.png)

<a name="prerequisites"/>

# 前提条件

<a name="docker"/>

## Docker

物事を単純にするために、両方のコンポーネントが [Docker](https://www.docker.com) を使用して実行されます。**Docker** は、
さまざまコンポーネントをそれぞれの環境に分離することを可能にするコンテナ・テクノロジです。

-   Windows に Docker をインストールするには、[こちら](https://docs.docker.com/docker-for-windows/)の指示に従ってください
-   Mac に Docker をインストールするには、[こちら](https://docs.docker.com/docker-for-mac/)の指示に従ってください
-   Linux に Docker をインストールするには、[こちら](https://docs.docker.com/install/)の手順に従ってください

**Docker Compose** は、マルチコンテナ Docker アプリケーションを定義して実行するためのツールです。
[YAML ファイル](https://raw.githubusercontent.com/fiware/tutorials.LD-Subscriptions-Registrations/master/docker-compose/orion-ld.yml)
を使用して、アプリケーションに必要なサービスを設定します。これは、すべてのコンテナ・サービスを単一のコマンドで起動
できることを意味します。Docker Compose は、Docker for Windows および Docker for Mac の一部としてデフォルトでインストール
されますが、Linux ユーザは[こちら](https://docs.docker.com/compose/install/)にある手順に従う必要があります。

## WSL

簡単な bash スクリプトを使ってサービスを開始します。Windows ユーザは、Windows 上の Linux ディストリビューションに
似たコマンドライン機能を提供するために [を使用して Windows に Linux をインストールする方法](https://learn.microsoft.com/ja-jp/windows/wsl/install) をダウンロードするべきです。

<a name="architecture"/>

# アーキテクチャ

デモ・スーパーマーケット・アプリケーションは、準拠している Context Broker と NGSI-LD の呼び出しを送受信します。
NGSI-LD インターフェースは、[Orion Context Broker](https://fiware-orion.readthedocs.io/en/latest/) の実験バージョンで
利用できるため、デモ・アプリケーションは1つの FIWARE コンポーネントのみを使用します。

現在、Orion Context Broker は、オープンソース [MongoDB](https://www.mongodb.com/) テクノロジに依存して、保持している
コンテキスト・データの永続性を維持しています。外部ソースからコンテキスト・データをリクエストするために、シンプルな
Context Provider NGSI proxy  も追加されました。 コンテキストを視覚化し、対話するために、簡単な Express
アプリケーションを追加します。

したがって、アーキテクチャは次の4つの要素で構成されます。

-   [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json)
    を使ってリクエストを受け取る [Orion Context Broker](https://fiware-orion.readthedocs.io/en/latest/)
-   基礎となる [MongoDB](https://www.mongodb.com/) データベース :
    -   データ・エンティティ、サブスクリプション、レジストレーションなどのコンテキスト・データ情報を保持するために
        Orion Context Broker によって使用されます
-   **Context Provider NGSI** は、次のことができます :
    -   [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json#/)
        を使用してリクエストを受信します
    -   独自の API を独自の形式で使用して、公開されているデータソースにリクエストを送信します
    -   コンテキスト・データを NGSI-lD 形式で
        [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json#/)
        形式で Orion Context Broker に返します
-   **在庫管理フロントエンド** は、次のことができます :
    -   ストア情報を表示
    -   各ストアで購入できる製品を表示
    -   ユーザが製品を "購入" して在庫数を減らすことを許可

要素間のすべての対話は HTTP リクエストによって開始されるため、エンティティはコンテナ化され、公開されたポートから実行
できます。

![](https://fiware.github.io/tutorials.LD-Subscriptions-Registrations/img/architecture.png)

必要な設定情報は、関連する `orion-ld.yml` ファイルの services セクションで確認できます。
[以前のチュートリアル](https://github.com/FIWARE/tutorials.Working-with-Linked-Data/) で説明しています。

<a name="start-up"/>

# 起動

[services](https://github.com/FIWARE/tutorials.LD-Subscriptions-Registrations/blob/NGSI-v2/services) Bash スクリプトを
実行して、コマンドラインから初期化できます。以下のようにコマンドを実行して、リポジトリのクローンを作成して必要な
イメージを作成してください :

```bash
git clone https://github.com/FIWARE/tutorials.Context-Providers.git
cd tutorials.Context-Providers
git checkout NGSI-LD

./services [orion|scorpio|stellio]
```

> **注:** クリーンアップして最初からやり直す場合は、次のコマンドで実行できます :
>
> ```
> ./services stop
> ```

---

<a name="interactions-between-components"/>

# コンポーネント間の相互作用

<a name="using-subscriptions-with-ngsi-ld"/>

## NGSI-LD でのサブスクリプションの使用

`http:/localhost:3000/app/store/urn:ngsi-ld:Building:store001` に移動して、スーパーマーケットのデータを表示して操作します。

<a name="create-a-subscription-store-1---low-stock"/>

### サブスクリプションを作成 (Store 1) - 低在庫

NGSI-LD サブスクリプションは、`/ngsi-ld/v1/subscriptions/` エンドポイントを使用して、NGSI-v2 `/v2/subscriptions`
エンドポイントと同様の方法で設定できます。ただし、ペイロード本体は少し異なります。まず、リンクト・データ `@context`
は属性として、または `Link` ヘッダに存在する必要があります。`@context` がボディに配置されている場合、`Context-Type`
ヘッダはペイロードが `application/ld+json`、つまり、リンクト・データと JSON であることを示す必要があります。提供された
`@context` は、通知リクエスト (notification request) の一部として通知を行うときにも使用されます。

NGSI-LD サブスクリプション・リクエストの `type` は常に `type=Subscription` です。サブスクリプションの構造が変更されました。
サブスクリプションを設定するとき、ペイロードに対する個別の `subject` セクションはなくなり、条件を監視およびトリガーする
エンティティはサブスクリプションの `description` と同じレベルに設定されるようになりました。

-   `condition.attrs` は1つ上のレベルに移動し、`watchedAttributes` に名前が変更されました
-   `condition.expression` が1つ上のレベルに移動し、`q` に名前が変更されました

ボディの `notification`  セクションには、サブスクリプションの条件が満たされると、影響を受けるすべての Shelf
エンティティを含む POST リクエストが URL `http://tutorial:3000/subscription/low-stock-store001` に送信されることが記載
されています。`notification.format=keyValues` をリクエストして通知ペイロードを修正し、
`notification.endpoint.accept=application/json` を指定して通知ボディから `@context` を削除できるようになりました。
`@context` は失われず、単に `Link` ヘッダとして渡されます。要約すると、サブスクリプション内のすべてのフラグは、
Context Broker 自体への GET リクエストと同じように機能します。フラグが設定されていない場合、デフォルトで `@context`
を含む完全な NGSI-LD レスポンスが返され、さらに制限を追加することでペイロードを削減および修正できます。

#### 1️⃣ リクエスト:

```console
curl -L -X POST 'http://localhost:1026/ngsi-ld/v1/subscriptions/' \
-H 'Content-Type: application/ld+json' \
--data-raw '{
  "description": "Notify me of low stock in Store 001",
  "type": "Subscription",
  "entities": [{"type": "Shelf"}],
  "watchedAttributes": ["numberOfItems"],
  "q": "numberOfItems<10;locatedIn==%22urn:ngsi-ld:Building:store001%22",
  "notification": {
    "attributes": ["numberOfItems", "stocks", "locatedIn"],
    "format": "keyValues",
    "endpoint": {
      "uri": "http://tutorial:3000/subscription/low-stock-store001",
      "accept": "application/json"
    }
  },
   "@context": "https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld"
}'
```

<a name="create-a-subscription-store-2---low-stock"/>

### サブスクリプションを作成 (Store 2) - 低在庫

この2番目のリクエストは、別のエンドポイント (URL `http://tutorial:3000/subscription/low-stock-store002`) に通知を送信
します。`notification.format=normalized` および `notification.endpoint.accept=application/ld+json` は、通知リクエストの
ボディで `@context` が渡され、ペイロードが展開されたエンティティで構成されることを保証します。

#### 2️⃣ リクエスト:

```console
curl -L -X POST 'http://localhost:1026/ngsi-ld/v1/subscriptions/' \
-H 'Content-Type: application/json' \
-H 'Link: <https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
--data-raw '{
  "description": "LD Notify me of low stock in Store 002",
  "type": "Subscription",
  "entities": [{"type": "Shelf"}],
  "watchedAttributes": ["numberOfItems"],
  "q": "numberOfItems<10;locatedIn==%22urn:ngsi-ld:Building:store002%22",
  "notification": {
    "attributes": ["numberOfItems", "stocks", "locatedIn"],
    "format": "normalized",
    "endpoint": {
      "uri": "http://tutorial:3000/subscription/low-stock-store002",
      "accept": "application/ld+json"
    }
  }
}'
```

<a name="read-subscription-details"/>

### サブスクリプションの詳細を取得

サブスクリプションの詳細は、`/ngsi-ld/v1/subscriptions/` に GET リクエストを行うことで取得できます。すべての
サブスクリプション CRUD アクションは、以前と同じ HTTP 動詞に引き続きマップされます。`Accept:application/json` を追加
すると、レスポンスボディから`@context` 要素が削除されます。

#### 3️⃣ リクエスト:

```console
curl -L -X GET 'http://localhost:1026/ngsi-ld/v1/subscriptions/'
```

#### レスポンス:

レスポンスは、システム内のサブスクリプションの詳細で構成されています。内部的にブローカーは長い名前を一貫して使用する
ため、`q` 属性内のパラメータは完全な URIs を使用するように拡張されました。2つのサブスクリプションによって提供される
ペイロードの違いについては、以下で説明します。

```json
[
    {
        "id": "urn:ngsi-ld:Subscription:5e62405ee232da3a07b5fa7f",
        "type": "Subscription",
        "description": "Notify me of low stock in Store 001",
        "entities": [
            {
                "type": "Shelf"
            }
        ],
        "watchedAttributes": [
            "numberOfItems"
        ],
        "q": "https://fiware.github.io/tutorials.Step-by-Step/schema/numberOfItems<10;https://fiware.github.io/tutorials.Step-by-Step/schema/locatedIn==%22urn:ngsi-ld:Building:store001%22",
        "notification": {
            "attributes": [
                "numberOfItems",
                "stocks",
                "locatedIn"
            ],
            "format": "keyValues",
            "endpoint": {
                "uri": "http://tutorial:3000/subscription/low-stock-store001",
                "accept": "application/json"
            }
        },
        "@context": "https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld"
    },
    {
        "id": "urn:ngsi-ld:Subscription:5e624063e232da3a07b5fa80",
        "type": "Subscription",
        "description": "Notify me of low stock in Store 002",
        "entities": [
            {
                "type": "Shelf"
            }
        ],
        "watchedAttributes": [
            "numberOfItems"
        ],
        "q": "https://fiware.github.io/tutorials.Step-by-Step/schema/numberOfItems<10;https://fiware.github.io/tutorials.Step-by-Step/schema/locatedIn==%22urn:ngsi-ld:Building:store002%22",
        "notification": {
            "attributes": [
                "numberOfItems",
                "stocks",
                "locatedIn"
            ],
            "format": "keyValues",
            "endpoint": {
                "uri": "http://tutorial:3000/subscription/low-stock-store002",
                "accept": "application/json"
            }
        },
        "@context": "https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld"
    }
]
```

<a name="retrieving-subscription-events"/>

### サブスクリプション・イベントの取得

ブラウザで2つのタブを開きます。イベント・モニタ (`http://localhost:3000/app/monitor`) に移動して、サブスクリプションの
起動時に受信されるペイロードを確認し、store001 (`http:/localhost:3000/app/store/urn:ngsi-ld:Building:store001`) 、
在庫が10未満になるまでビールを購入します。在庫不足のメッセージが画面に表示されます。

![low-stock](https://fiware.github.io/tutorials.LD-Subscriptions-Registrations/img/low-stock-warehouse.png)

`low-stock-store001` は、Store001 内の棚 (shelves) の商品が少なくなると発生します。サブスクリプションのペイロードは
以下のようになります。

![low-stock-json](https://fiware.github.io/tutorials.LD-Subscriptions-Registrations/img/low-stock-monitor.png)

ペイロード内のデータは、リクエストで指定された属性のキーと値のペアで構成されています。これは、サブスクリプションが
`format=keyValues` 属性を使用して作成されたためです。`endpoint.accept=application/json` が設定されているため、
`@context` はペイロードのボディに存在しません。その結果、`data` 配列は `v2/subscription/` ペイロードと非常によく似た
形式で返されます。`data` 配列に加えて、`subscriptionId` は、通知がいつ起動されたかを説明する `notifiedAt` 要素とともに
レスポンスに含まれます。

次に store002 (`http:/localhost:3000/app/store/urn:ngsi-ld:Building:store002`) に移動して、在庫が10未満になるまでビール
を購入します。在庫不足のメッセージが再び画面に表示され、イベント・モニタ内でペイロードを確認できます。

![low-stock-ld](https://fiware.github.io/tutorials.LD-Subscriptions-Registrations/img/low-stock-monitor-ld.png)

2番目のサブスクリプションは、`@context` とともに正規化された完全な NGSI-LD ペイロードを渡すように設定されています。
これは、サブスクリプション自体の中で `format=normalized` 属性を使用することと、`endpoint.accept=application/ld +json`
を設定することで実現され、各エンティティとともに `@context` も渡されます。

<a name="using-registrations-with-ngsi-ld"/>

## NGSI-LD でのレジストレーションの使用

コンテキスト・レジストレーションを使用すると、エンティティ内の一部 (またはすべて) のデータを外部コンテキスト・プロバイダ
から提供できます。これは、NGSI-LD エンドポイントのサブセットにのみレスポンスする別のマイクロサービスである別の完全な
コンテキスト・プロバイダである可能性があります。ただし、だれが何を提供するかについて作成されたコントラクトが必要です。

すべてのレジストレーションは、2つのタイプのいずれかに細分することができます。単一のコンテキスト・プロバイダが
エンティティ全体のメンテナンスを担当する単純なレジストレーションと、属性が複数のコンテキスト・プロバイダに分散している
部分的なレジストレーションです。単純なレジストレーションの場合、すべてのコンテキスト・リクエストが転送されます。

| リクエスト | **Context Broker** でのアクション                                                       | **コンテキスト・プロバイダ**でのアクション                                                                   |
| ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **GET**    | リクエストを**コンテキスト・プロバイダ**に渡し、レスポンスを変更せずにプロキシします    | 内部で保持されているエンティティに基づく GET リクエストの結果で Context Broker にレスポンスします            |
| **PATCH**  | リクエストを**コンテキスト・プロバイダ**に渡し、HTTP ステータス・コードをプロキシします | **コンテキスト・プロバイダ**内のエンティティを更新し、ステータス・コードで Context Broker にレスポンスします |
| **DELETE** | **コンテキスト・プロバイダ**にリクエストを渡します                                      | **コンテキスト・プロバイダ**内のエンティティを削除し、ステータス・コードで Context Broker にレスポンスします |

事実上、すべての単純なレジストレーションは _"このエンティティは別の場所に保持されています"_ と言っていますが、
エンティティ・データは、この Context Broker へのリクエストを介してリクエストおよび変更できます。すべての
Context Brokers は単純なレジストレーションをサポートする必要があります。実際、"エンティティの排他性"
の概念がない、つまり、個々の broker にエンティティがバインドされていない大規模システムで動作する Context
Brokers のフェデレーション・アレイの操作には、このような単純なレジストレーションが必要です。

部分レジストレーションの場合、状況はより複雑になります。

| リクエスト | **Context Broker** でのアクション                                                                                                                                                                                                                                         | **コンテキスト・プロバイダ**でのアクション                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GET**    | エンティティがローカルに存在すると仮定して、追加のプロキシされた属性のリクエストを**コンテキスト・プロバイダ**に渡し、ローカルに保持されている属性と**コンテキスト・プロバイダ**からの追加情報のレスポンスを連結します                                                    | 内部で保持されているエンティティに基づく GET リクエストの結果で Context Broker にレスポンスします                                                   |
| **PATCH**  | ローカルに保持されている属性を更新し、追加の属性の更新リクエストを**コンテキスト・プロバイダ**に渡し、全体的な結果に応じて**成功**または**部分的に成功**の HTTP ステータス・コードを返します                                                                              | **コンテキスト・プロバイダ**内に保持されているエンティティのリクエストされた属性を更新します。ステータス・コードで Context Broker にレスポンスします |
| **DELETE** | エンティティを削除する場合は、ローカル・インスタンス全体を削除してください。ローカルに保持されている属性を削除する場合は、それらを削除してください。**コンテキスト・プロバイダ**に保持されている属性を削除する場合は、**コンテキスト・プロバイダ**にリクエストを渡します | **コンテキスト・プロバイダ**内のエンティティ属性を削除し、ステータス・コードで Context Broker にレスポンスします                                     |

各部分レジストレーションは、_"このエンティティの追加の拡張コンテキストは別の場所に保持されている"_ と述べています。
エンティティ・データは、この Context Broker へのリクエストを介してリクエストおよび変更できます。この場合、
エンティティ・データは個々の Context Broker に効果的にバインドされるため、大規模なフェデレーション環境で実行する
場合は特別な処理が必要になる場合があります。ここで、フェデレーションのユースケースの特別なニーズをカバーすることは、
このチュートリアルの目的ではありません。

Context Broker 内では、単一のエンティティが単純なレジストレーションと部分的なレジストレーションの両方に同時に
参加できないことに注意してください。これは、エンティティ全体とそのエンティティの一部のみの両方がリモートで
取得されることを意味し、これは無意味です。このような状況が要求された場合、Context Broker は
409 - Conflict HTTP response を返します。

また、エンティティが Context Broker 内にすでに存在する場合、エンティティの単純なレジストレーションは拒否され、
エンティティ属性の部分レジストレーションは、Context Broker 内に存在する、またはすでに部分レジストレーションの
対象となっている場合、拒否されます。後者は、datasetId を使用することで発生する可能性があります。

内部的に X-Forwarded-For ヘッダは、Context Broker A がエンティティを Context Broker B にレジストレーションし、
Context Broker B がエンティティを Context Broker C にレジストレーションし、Context Broker C がエンティティを
Context Broker A にレジストレーションする循環依存関係を回避するために使用されます。ただし、X-Forwarded-For
ヘッダは、クライアントにレスポンスする前に削除されます。

通常の操作では、NGSI-LD レスポンスは、複数のソースから照合されたデータが Context Broker 内に直接保持されているかどうか、
または情報が外部から取得されたかどうかを公開しません。エラーが発生した場合 (タイムアウトなど) にのみ、HTTP ステータス・
エラーコードにより、外部で保持されている情報を取得または修正できなかったことがわかります。

<a name="create-a-registration"/>

### レジストレーションを作成

すべての NGSI-LD コンテキスト・プロバイダのレジストレーション・アクションは、`/ngsi-ld/v1/csourceRegistrations/`
エンドポイントで実行されます。標準の CRUD マッピングが適用されます。`@context` は、`Link` ヘッダとして、または
リクエストのボディ内で渡す必要があります。

リクエストのボディは、次の変更を加えた同等の NGSI-v2 に似ています:

-   NGSI-v2 `dataProvided` オブジェクトは、`information` という配列になりました
-   NGSI-v2 属性は、`properties` と `relationships` の個別の配列に分割されました
-   NGSI-v2 `provider.url`が `endpoint` に移動しました

#### 4️⃣ リクエスト:

```console
curl -L -X POST 'http://localhost:1026/ngsi-ld/v1/csourceRegistrations/' \
-H 'Content-Type: application/json' \
-H 'Link: <https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
--data-raw ' {
    "type": "ContextSourceRegistration",
    "information": [
        {
            "entities": [
                {
                    "type": "Building",
                    "id": "urn:ngsi-ld:Building:store001"
                }
            ],
            "properties": [
                "tweets"
            ]
        }
    ],
    "endpoint": "http://tutorial:3000/static/tweets"
}'
```

> **注** `properties` は 1.1.1 NGSI-LD コア・コンテキストで定義されています。1.3.1 では、2つの別個の属性
> (`propertyNames` と `relationshipNames`) に置き換えられる予定です。この変更は、GeoJSON-LD を完全に
> サポートするために行われました。Context Broker は、更新されたコア・コンテキストをサポートする場合と
> サポートしない場合があります。

<a name="read-registration-details"/>

### レジストレーションの詳細を取得

レジストレーションの詳細を取得するには、GETリクエストを `/ngsi-ld/v1/csourceRegistrations/` エンドポイントに送信し、
`Link` ヘッダの適切な JSON-LD コンテキストとフィルタリングするエンティティの `type` を指定します。

#### 5️⃣ リクエスト:

```console
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/csourceRegistrations/' \
-H 'Accept: application/ld+json' \
-H 'Link: <https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'  \
-d 'type=Building'
```

#### レスポンス:

レスポンスはレジストレーションの詳細を返します。この場合、`properties` の短い名前が `@context`
とともに返されています。

```json
[
    {
        "@context": "https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld",
        "id": "urn:ngsi-ld:ContextSourceRegistration:5e6242179c26be5aef9991d4",
        "type": "ContextSourceRegistration",
        "endpoint": "http://tutorial:3000/static/tweets",
        "information": [
            {
                "entities": [
                    {
                        "id": "urn:ngsi-ld:Building:store001",
                        "type": "Building"
                    }
                ],
                "properties": [
                    "tweets"
                ]
            }
        ]
    }
]
```

<a name="read-from-store-1"/>

### Store 1 から取得

レジストレーションが設定されると、要求されたエンティティがリクエストされると、追加のレジストレーション済みプロパティと
リレーションシップが透過的に返されます。 単純なレジストレーションの場合、エンティティ全体を取得するリクエストは
レジストレーションされたエンドポイントにプロキシされます。部分的なレジストレーションの場合、プロパティと
レジストレーションは Context Broker 内に保持されている既存のエンティティに追加されます。

#### 6️⃣ リクエスト:

```console
curl -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Building:store001' \
-H 'Link: <https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Content-Type: application/json'
```

> 執筆時点では、フェデレーションされた、Scorpio Broker の場合、このリクエストはローカル・エンティティのみの取得を
> 示していることに注意してください。レジストレーションから転送されたデータは、代わりに次の方法で取得する必要があります:
> `/ngsi-ld/v1/entities/?id=urn:ngsi-ld:Building:store001`

#### レスポンス:

レスポンスには、追加の `tweets` プロパティが含まれるようになりました。このプロパティは、
`http://tutorial:3000/static/tweets/ngsi-ld/v1/entities/urn:ngsi-ld:Building:store001`
から取得した値を返します。例えば、フォワーディング・エンドポイント

```json
{
    "@context": "https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld",
    "id": "urn:ngsi-ld:Building:store001",
    "type": "Building",
    "furniture": {
        "type": "Relationship",
        "object": [
            "urn:ngsi-ld:Shelf:unit001",
            "urn:ngsi-ld:Shelf:unit002",
            "urn:ngsi-ld:Shelf:unit003"
        ]
    },
    "address": {
        "type": "Property",
        "value": {
            "streetAddress": "Bornholmer Straße 65",
            "addressRegion": "Berlin",
            "addressLocality": "Prenzlauer Berg",
            "postalCode": "10439"
        },
        "verified": {
            "type": "Property",
            "value": true
        }
    },
    "name": {
        "type": "Property",
        "value": "Bösebrücke Einkauf"
    },
    "category": {
        "type": "Property",
        "value": "commercial"
    },
    "location": {
        "type": "GeoProperty",
        "value": {
            "type": "Point",
            "coordinates": [
                13.3986,
                52.5547
            ]
        }
    },
    "tweets": {
        "type": "Property",
        "value": [
            "It has great practical value – you can wrap it around you for warmth as you bound across the cold moons of Jaglan Beta;",
            "You can lie on it on the brilliant marble-sanded beaches of Santraginus V, inhaling the heady sea vapours;",
            "You can sleep under it beneath the stars which shine so redly on the desert world of Kakrafoon;",
            "Use it to sail a mini raft down the slow heavy river Moth;",
            "Wet it for use in hand-to-hand-combat;",
            "Wrap it round your head to ward off noxious fumes or to avoid the gaze of the Ravenous Bugblatter Beast of Traal  (a mindboggingly stupid animal, it assumes that if you can’t see it, it can’t see you – daft as a bush, but very, very ravenous);",
            "You can wave your towel in emergencies as a distress signal, and of course dry yourself off with it if it still seems to be clean enough."
        ]
    }
}
```

同じレスポンスデータは、スーパーマーケット・アプリケーション自体で確認できます。実際には、このデータは一連のリクエスト
を介して作成されています。 Context Broker は `urn:ngsi-ld:Building:store001`  データを担当しますが、他のソースから提供
できる情報があるかどうかを確認します。私たちの場合、`CSourceRegistration` は、もう1つの属性が使用できることを示して
います。次にブローカーはコンテキスト・プロバイダに `tweets` 情報をリクエストし、タイムリーにレスポンスする場合、
 `tweets` 情報が結果のペイロードに追加されます。

スーパーマーケット・アプリケーションは、スーパーマーケット・アプリケーション自体の画面に受信データを表示します :

![tweets-1](https://fiware.github.io/tutorials.LD-Subscriptions-Registrations/img/tweets-1.png)

### コンテキスト・プロバイダから直接取得

すべてのコンテキスト・プロバイダは、固定されたコントラクトに従う必要があります。少なくとも、
`/ngsi-ld/v1/entities/<entity-id>` GET リクエストのさまざまな種類にレスポンスできる必要があります。レジストレーションが
特定のプロパティに制限されている場合、このリクエストにはクエリ文字列に `attrs` パラメータも含まれます。

コンテキスト・プロバイダのユースケースに応じて、JSON-LD `@context` を解釈できる必要がある場合とそうでない場合が
あります。この場合、リクエストは完全な `tweets` 属性を返すだけです。

レジストレーションされた属性を照会するときに、同じリクエストが Context Broker 自体によって行われます。

#### 7️⃣ リクエスト:

```console
curl -L -X GET 'http://localhost:3000/static/tweets/ngsi-ld/v1/entities/urn:ngsi-ld:Building:store001?attrs=tweets' \
-H 'Link: <https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Content-Type: application/ld+json'
```

#### レスポンス:

ご覧のように、`@context` はリクエストで返されています (`Content-Type` ヘッダが設定されているため) 。
残りのレスポンスは、標準の NGSI-LD リクエストに似ています。

```json
{
    "@context": "https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld",
    "id": "urn:ngsi-ld:Building:store001",
    "type": "Building",
    "tweets": {
        "type": "Property",
        "value": [
            "It has great practical value – you can wrap it around you for warmth as you bound across the cold moons of Jaglan Beta;",
            "You can lie on it on the brilliant marble-sanded beaches of Santraginus V, inhaling the heady sea vapours;",
            "You can sleep under it beneath the stars which shine so redly on the desert world of Kakrafoon;",
            "Use it to sail a mini raft down the slow heavy river Moth;",
            "Wet it for use in hand-to-hand-combat;",
            "Wrap it round your head to ward off noxious fumes or to avoid the gaze of the Ravenous Bugblatter Beast of Traal  (a mindboggingly stupid animal, it assumes that if you can’t see it, it can’t see you – daft as a bush, but very, very ravenous);",
            "You can wave your towel in emergencies as a distress signal, and of course dry yourself off with it if it still seems to be clean enough."
        ]
    }
}
```

### コンテキスト・プロバイダの直接更新

読み取り/書き込みインターフェースの場合、関連する `ngsi-ld/v1/entities/<entity-id>/attrs` エンドポイントに PATCH
リクエストを行うことで、コンテキスト・データを修正することもできます。

#### 8️⃣ リクエスト:

```console
curl -L -X PATCH 'http://localhost:3000/static/tweets/ngsi-ld/v1/entities/urn:ngsi-ld:Building:store001/attrs' \
-H 'Link: <https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Content-Type: application/json' \
--data-raw '{
  "tweets": {
    "type": "Property",
    "value": [
      "Space is big.",
      "You just won'\''t believe how vastly, hugely, mind-bogglingly big it is.",
      "I mean, you may think it'\''s a long way down the road to the chemist'\''s, but that'\''s just peanuts to space."
    ]
  }
}'
```

#### 9️⃣ リクエスト:

レジストレーションされた属性が Context Broker からリクエストされた場合、
`http://tutorial:3000/static/tweets/ngsi-ld/v1/entities/urn:ngsi-ld:Building:store001`
から取得した更新された値を返します。例えば、フォワーディング・エンドポイント

```console
curl -L -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Building:store001?attrs=tweets&options=keyValues' \
-H 'Link: <https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

#### レスポンス:

これにより、前の PATCH リクエストで更新された値と一致するようにレスポンスが変更されます。

```json
{
    "@context": "https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld",
    "id": "urn:ngsi-ld:Building:store001",
    "type": "Building",
    "tweets": [
        "Space is big.",
        "You just won't believe how vastly, hugely, mind-bogglingly big it is.",
        "I mean, you may think it's a long way down the road to the chemist's, but that's just peanuts to space."
    ]
}
```

コンテキスト・プロバイダは `tweets`  情報の提供を担当するため、コンテキスト・プロバイダの変更は常に Context Broker
自体へのリクエストに反映されます。スーパーマーケット・アプリケーションはコンテキストに関係なく Context Broker を
呼び出しているため、更新された `tweets` データはスーパーマーケット・アプリケーション自体の画面に表示されます。

![tweets-2](https://fiware.github.io/tutorials.LD-Subscriptions-Registrations/img/tweets-2.png)

したがって、 Context Broker は、世界の現在の状態の完全な全体像を返すことができます。

<a name="forwarded-update"/>

### フォワード更新 (Forwarded-update)

#### 1️⃣0️⃣ リクエスト:

Context Broker への PATCH リクエスト (`ngsi-ld/v1/entities/<entity-id>/` または
`ngsi-ld/v1/entities/<entity-id>/attrs`) は、レジストレーションが見つかった場合、レジストレーションされたコンテキスト
・プロバイダに転送されます。したがって、副作用としてコンテキスト・プロバイダの状態を変更することが可能です。もちろん、
すべてのコンテキスト・プロバイダが必ずしも読み書き可能であるとは限らないため、転送されたコンテキストの属性を変更
しようとしても、完全に尊重されるとは限りません。

ただし、この場合、PATCH `ngsi-ld/v1/entities/<entity-id>` へのリクエストは、レジストレーションで見つかった
レジストレーションされた各属性に対する、一連の `ngsi-ld/v1/entities/<entity-id>/attrs` リクエストとして正常に転送
されます。

```console
curl -L -X PATCH 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Building:store001/attrs/tweets' \
-H 'Link: <https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Content-Type: application/json' \
--data-raw '{
  "type": "Property",
  "value": [
    "This must be Thursday",
    "I never could get the hang of Thursdays."
  ]
} '
```

#### 1️⃣1️⃣ リクエスト:

前の操作の結果は、GET リクエストを使用してエンティティ全体を取得することで確認できます。

```console
curl -L -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Building:store001?attrs=tweets&options=keyValues' \
-H 'Link: <https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Content-Type: application/json'
```

#### レスポンス:

これにより、Context Broker に送信されてからコンテキスト・プロバイダのエンドポイントにフォワーディングされた前の
PATCH リクエストで更新された値と一致するようにレスポンスが変更されます。

```json
{
    "@context": "https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld",
    "id": "urn:ngsi-ld:Building:store001",
    "type": "Building",
    "tweets": [
        "This must be Thursday",
        "I never could get the hang of Thursdays."
    ]
}
```

ご覧のように、更新された `tweets` データもスーパーマーケット・アプリケーション自体に表示されます :

![tweets-3](https://fiware.github.io/tutorials.LD-Subscriptions-Registrations/img/tweets-3.png)

---

## License

[MIT](LICENSE) © 2020-2025 FIWARE Foundation e.V.
