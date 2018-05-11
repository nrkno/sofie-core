@Library('sofie-jenkins-lib') _

pipeline {
  agent any
  stages {
    stage('Build Docker image') {
      steps {
          dockerBuild('sofie/tv-automation-server-core')
      }
    }
  }
}
