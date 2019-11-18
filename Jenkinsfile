@Library('sofie-jenkins-lib') _

pipeline {
  agent any
  stages {
    /*
    stage('Version') {
      when {
        branch 'master'
      }
      steps {
        versionRelease('meteor')
      }
    }
    */
    stage('Build') {
      steps {
        sofieSlackSendBuildStarted()
        dockerBuild('sofie/tv-automation-server-core')
      }
    }
    stage('Deploy') {
      when {		
        branch 'develop'		
      }
      steps {
        coreDeploy('malxsofietest02')
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
