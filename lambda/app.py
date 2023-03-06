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
      if e.response['Error']['Code'] == 'DecryptionFailureException':
          # Secrets Manager can't decrypt the protected secret text using the provided KMS key.
          # Deal with the exception here, and/or rethrow at your discretion.
          raise e
      elif e.response['Error']['Code'] == 'InternalServiceErrorException':
          # An error occurred on the server side.
          # Deal with the exception here, and/or rethrow at your discretion.
          raise e
      elif e.response['Error']['Code'] == 'InvalidParameterException':
          # You provided an invalid value for a parameter.
          # Deal with the exception here, and/or rethrow at your discretion.
          raise e
      elif e.response['Error']['Code'] == 'InvalidRequestException':
          # You provided a parameter value that is not valid for the current state of the resource.
          # Deal with the exception here, and/or rethrow at your discretion.
          raise e
      elif e.response['Error']['Code'] == 'ResourceNotFoundException':
          # We can't find the resource that you asked for.
          # Deal with the exception here, and/or rethrow at your discretion.
          raise e
  else:
      # Decrypts secret using the associated KMS CMK.
      # Depending on whether the secret is a string or binary, one of these fields will be populated.
      if 'SecretString' in get_secret_value_response:
          secret = get_secret_value_response['SecretString']
      else:
          decoded_binary_secret = base64.b64decode(get_secret_value_response['SecretBinary'])

def handler(event, context):
  text = "ID:{} の {}までのAWS合計料金 : ${}".format(id_info['Account'], END_DATE, get_total_cost())
  content = {"text": text}

  SLACK_POST_URL = get_secret()

  slack_message = {
      'channel': SLACK_CHANNEL,
      "attachments": [content],
  }

  try:
      requests.post(SLACK_POST_URL, data=json.dumps(slack_message))
  except requests.exceptions.RequestException as e:
      logger.error("Request failed: %s", e)