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
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
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
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            'SecretsManagerReadWrite'
          )
        ],
      }
    );

    // lambda
    const costalertLambda = new lambda.Function(this, 'NotifyPriceHandler', {
      runtime: lambda.Runtime.PYTHON_3_9,    // execution environment
      code: lambda.Code.fromAsset('lambda'),  // code loaded from "lambda" directory
      handler: 'app.handler',                // file is "hello", function is "handler"
      environment: {
        TZ: 'Asia/Tokyo',
        SLACK_CHANNEL: slackChannel,
      },
      layers: [layer],
      initialPolicy: [new iam.PolicyStatement({
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