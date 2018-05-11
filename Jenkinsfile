@Library('sofie-jenkins-lib') _

pipeline {
  agent any
  stages {
    stage('Build') {
      steps {
          dockerBuild('sofie/tv-automation-server-core')
      }
    }
    stage('Deploy') {
      steps {
          testDeploy('tv-automation-server-core')
      }
    }
  }
}
