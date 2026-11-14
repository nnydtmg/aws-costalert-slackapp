import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from "aws-cdk-lib/aws-events";
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

export class AwsCostalertSlackappStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Parameter
    const slackChannel = StringParameter.valueForStringParameter(this, '/costalert-slackapp/channel');

    // lambda-layer
    const layer = new lambda.LayerVersion(this, 'MyLayer', {
      code: lambda.Code.fromAsset("lambda_layer"),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_13],
    });
    
    const executionLambdaRole = new iam.Role(
      this,
      'CostalertLambdaExecutionRole',
      {
        roleName: 'costalert-lambda-execution-role',
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaBasicExecutionRole'
          ),
        ],
      }
    );

    // Slack の投稿先 URL を保持するシークレット（lambda/app.py の secret_name / region_name と合わせる）。
    // 以前は AWS 管理ポリシー SecretsManagerReadWrite（全シークレットの読み書き）を付与していたが、
    // Lambda が必要とするのはこのシークレットの読み取りのみなので GetSecretValue に絞る。
    // 末尾の "-??????" は Secrets Manager がシークレット ARN に付与するランダムな 6 文字。
    executionLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [
        cdk.Stack.of(this).formatArn({
          service: 'secretsmanager',
          region: 'ap-northeast-1',
          resource: 'secret',
          resourceName: 'alertapp/url-??????',
          arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
        }),
      ],
    }));

    // lambda
    const costalertLambda = new lambda.Function(this, 'NotifyPriceHandler', {
      runtime: lambda.Runtime.PYTHON_3_13,    // execution environment
      code: lambda.Code.fromAsset('lambda'),  // code loaded from "lambda" directory
      handler: 'app.handler',                // file is "hello", function is "handler"
      environment: {
        TZ: 'Asia/Tokyo',
        SLACK_CHANNEL: slackChannel,
      },
      layers: [layer],
      initialPolicy: [new iam.PolicyStatement({
        // Cost Explorer の GetCostAndUsage はリソースレベルの権限をサポートしないため '*' が必須
        actions: ['ce:GetCostAndUsage'],
        resources: ['*'],
      })],
      role: executionLambdaRole
    });

    // EventBridge
    new events.Rule(this, "costalertRule", {
      // JST で毎日 AM9:10 に定期実行
      // 参考 https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/events/ScheduledEvents.html#CronExpressions
      schedule: events.Schedule.cron({minute: "10", hour: "0"}),
      targets: [new targets.LambdaFunction(costalertLambda, {retryAttempts: 3})],
    });
  }
}