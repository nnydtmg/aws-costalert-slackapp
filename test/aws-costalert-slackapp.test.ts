import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as AwsCostalertSlackapp from '../lib/aws-costalert-slackapp-stack';

let template: Template;

beforeAll(() => {
  // Lambda レイヤーの中身（requests）はビルド時に pip で用意するためリポジトリには含まれない。
  // テストでは空ディレクトリでアセットを解決させる。
  fs.mkdirSync(path.join(__dirname, '..', 'lambda_layer', 'python'), { recursive: true });
  const app = new cdk.App();
  const stack = new AwsCostalertSlackapp.AwsCostalertSlackappStack(app, 'MyTestStack');
  template = Template.fromStack(stack);
});

test('Lambda がサポート中の Python ランタイムで作成されること', () => {
  template.hasResourceProperties('AWS::Lambda::Function', {
    Runtime: 'python3.13',
    Handler: 'app.handler',
  });
});

test('実行ロールに SecretsManagerReadWrite が付与されていないこと', () => {
  const roles = template.findResources('AWS::IAM::Role');
  expect(JSON.stringify(roles)).not.toContain('SecretsManagerReadWrite');
});

test('シークレットの読み取り権限が対象シークレットに限定されていること', () => {
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: 'secretsmanager:GetSecretValue',
          Resource: {
            'Fn::Join': ['', Match.arrayWith([Match.stringLikeRegexp(':secret:alertapp/url-\\?\\?\\?\\?\\?\\?$')])],
          },
        }),
      ]),
    },
  });
});
