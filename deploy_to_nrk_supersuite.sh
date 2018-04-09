
cd meteor 
DEPLOY_HOSTNAME="eu-west-1.galaxy-deploy.meteor.com"



echo Deploying to deploy nrk.supersuite.tv...
meteor deploy nrk.supersuite.tv --settings ../settings.json


echo Deployment complete.

