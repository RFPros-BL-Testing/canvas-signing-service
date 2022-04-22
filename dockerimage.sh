# 278482835815.dkr.ecr.us-east-1.amazonaws.com/canvas-signing-lambda

DockerPassword=9RF9O44LKBodk8Nw
DockerUsername=benlloydlaird
IMAGE_REPO_NAME=canvas-signing-lambda
AWS_ACCOUNT_ID=278482835815
AWS_REGION=us-east-1
PROFILE=liquid-dev

docker login --username $DockerUsername --password $DockerPassword
docker build -t $IMAGE_REPO_NAME:latest .
docker tag $IMAGE_REPO_NAME:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest

# $(aws ecr get-login --no-include-email --region $AWS_REGION)
aws ecr get-login-password --region $AWS_REGION --profile $PROFILE| docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest

