@Library('sofie-jenkins-lib') _

pipeline {
  agent any
  stages {
    stage('Version') {
      when {
        branch 'master'
      }
      steps {
        gatewayRelease()
      }
    }
    stage('Build') {
      steps {
        sofieSlackSendBuildStarted()
        dockerBuild('sofie/tv-automation-playout-gateway')
      }
    }
    stage('Deploy') {
      when {		
        branch 'stage'		
      }
      steps {
        parallel(
          test01: {
            playoutDeploy('malxsofietest01')
          },
          test02: {
            playoutDeploy('malxsofietest02')
          }
        )
      }
    }
  }
  post {
    failure {
      sofieSlackSendBuildFailure()
    }
    success {
      sofieSlackSendBuildSuccess()
    }
  }
}
