@Library('sofie-jenkins-lib') _

pipeline {
  agent any
  stages {
    stage('Build') {
      steps {
        sofieSlackSendBuildStarted()
        dockerBuild('sofie/tv-automation-server-core')
      }
    }
    stage('Deploy') {
      steps {
        coreDeploy()
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
