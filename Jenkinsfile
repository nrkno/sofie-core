@Library('sofie-jenkins-lib') _

pipeline {
  agent any
  stages {
    stage ('Checkout') {
      steps {
        deleteDir()
        checkout scm
      }
    }
    stage('Version') {
      when {
        branch 'master'
      }
      steps {
        versionRelease('meteor')
      }
    }
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
