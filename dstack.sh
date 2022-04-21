# Example command to deploy "liquid" stack, this being the "fileservice" application as the "dev" environment

# ./dstack.sh canvas signing dev liquid-dev
# ./dstack.sh canvas signing test liquid-dev
# ./dstack.sh canvas signing prod liquid-prod

STACK=$1
APPLICATION=$2
ENV=$3
PROFILE=$4
APPLICATIONNAME="$STACK-$APPLICATION"

MQTTENVIRONMENT=$ENV

# grab the current account id
ACCOUNT=$(aws sts get-caller-identity --profile "$PROFILE" | python -c "import sys, json; print json.load(sys.stdin)['Account']")
echo "Fetched ACCOUNT: $ACCOUNT"

# Define S3 Buckets
ACCOUNTPREFIX=$(echo "$ACCOUNT" | cut -c1-4)
S3ARTIFACTS="$ACCOUNTPREFIX-artifacts-$ENV"

# upload the cfnResources to the s3 bucket
aws s3 sync ./cfnResources "s3://$S3ARTIFACTS/cloudformation" --profile $PROFILE


# SSLDOMAIN="mgmt.lairdconnect.com"

aws cloudformation deploy \
  --profile "$PROFILE" \
  --template-file "cfnResources/cfnStackTemplate.yaml" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --stack-name "$APPLICATIONNAME-$ENV" \
  --parameter-overrides \
    "AccountPrefix=$ACCOUNTPREFIX" \
    "ApplicationName=$APPLICATIONNAME" \
    "ArtifactBucketName=$S3ARTIFACTS" \
    "ConnectionArn=arn:aws:codestar-connections:us-east-1:278482835815:connection/58381eb0-3cee-4ae2-a0ff-f692be51e12e" \
    "Environment=$ENV" \
    "OutpostBucketName=$ACCOUNTPREFIX-outpost-$ENV" \
    "Stack=$STACK"
