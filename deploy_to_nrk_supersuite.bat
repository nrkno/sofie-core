
cd meteor 
SET DEPLOY_HOSTNAME=eu-west-1.galaxy-deploy.meteor.com



echo Deploying to deploy nrksofie.supersuite.tv...
meteor deploy nrksofie.supersuite.tv --settings ../settings.json


echo Deployment complete.

PAUSE
