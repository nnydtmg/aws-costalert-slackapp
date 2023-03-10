# lambda/app.py

# encoding: utf-8
import json
import datetime
import requests
import boto3
import os
import logging
import base64
from botocore.exceptions import ClientError
import ast

TODAY = datetime.datetime.utcnow()
FIRST_DAY_OF_THE_MONTH = TODAY - datetime.timedelta(days=TODAY.day - 1)
START_DATE = FIRST_DAY_OF_THE_MONTH.strftime('%Y/%m/%d').replace('/', '-')
END_DATE = TODAY.strftime('%Y/%m/%d').replace('/', '-')

# SLACK_POST_URL = os.environ['SLACK_POST_URL']
SLACK_CHANNEL = os.environ['SLACK_CHANNEL']

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client = boto3.client('ce')
sts = boto3.client('sts')
id_info = sts.get_caller_identity()

def get_total_cost():
    response = client.get_cost_and_usage(
        TimePeriod={
            'Start': START_DATE,
            'End': END_DATE
        },
        Granularity='MONTHLY',
        Metrics=[
            'UnblendedCost',
        ],
    )

    total_cost = response["ResultsByTime"][0]["Total"]["UnblendedCost"]["Amount"]
    return total_cost

def get_secret():

    secret_name = "alertapp/url"
    region_name = "ap-northeast-1"

    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )

    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        # For a list of exceptions thrown, see
        # https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
        raise e

    # Decrypts secret using the associated KMS key.
    secret = get_secret_value_response['SecretString']
    return secret

def handler(event, context):
  text = "ID:{} の {}から{}までのAWS合計料金 : ${}".format(id_info['Account'], START_DATE, END_DATE, get_total_cost())
  content = {"text": text}

  secret = ast.literal_eval(get_secret())
  SLACK_POST_URL = secret['costalert-slackapp-url']

  slack_message = {
      'channel': SLACK_CHANNEL,
      "attachments": [content],
  }

  try:
      requests.post(SLACK_POST_URL, data=json.dumps(slack_message))
  except requests.exceptions.RequestException as e:
      logger.error("Request failed: %s", e)