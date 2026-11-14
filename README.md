# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## 事前準備

* Lambda レイヤー（`requests`）はリポジトリに含めていません。デプロイ前に作成してください。
  ```
  pip install requests -t lambda_layer/python
  ```
* Slack の投稿先 URL は Secrets Manager のシークレット `alertapp/url`（ap-northeast-1、キー `costalert-slackapp-url`）に、
  チャンネルは SSM パラメータ `/costalert-slackapp/channel` に登録しておきます。
* Lambda の実行ロールに付与するのは、上記シークレットの `secretsmanager:GetSecretValue` と
  `ce:GetCostAndUsage` だけです。`ce:GetCostAndUsage` はリソースレベルの権限に対応していないため、Resource は `*` になります。
  シークレット名やリージョンを変える場合は、`lambda/app.py` とスタックの両方を書き換えてください。
