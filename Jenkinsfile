@Library('sofie-jenkins-lib') _

pipeline {
  agent any
  stages {
    stage('Build') {
      failFast false

      parallel {
        stage('Build core') {
          steps {
            /* Persist git hash, this is the same as `meteor yarn run inject-git-hash` */
            sh "node ./meteor/scripts/generate-version-file.js"
            sofieSlackSendBuildStarted('core')
            dockerBuild('sofie/tv-automation-server-core', '.', './meteor/Dockerfile')
          }
          post {
            failure {
              sofieSlackSendBuildFailure('core')
            }
            success {
              sofieSlackSendBuildSuccess('core')
            }
          }
        }

        stage('Build playout gateway') {
          steps {
            sofieSlackSendBuildStarted('playout-gateway')
            dockerBuild('sofie/tv-automation-playout-gateway', './packages', './packages/playout-gateway/Dockerfile')
          }
          post {
            failure {
              sofieSlackSendBuildFailure('playout-gateway')
            }
            success {
              sofieSlackSendBuildSuccess('playout-gateway')
            }
          }
        }

        stage('Build mos gateway') {
          steps {
            sofieSlackSendBuildStarted('mos-gateway')
            dockerBuild('sofie/tv-automation-mos-gateway', './packages', './packages/mos-gateway/Dockerfile')
          }
          post {
            failure {
              sofieSlackSendBuildFailure('mos-gateway')
            }
            success {
              sofieSlackSendBuildSuccess('mos-gateway')
            }
          }
        }
      }
    }
  }
}
