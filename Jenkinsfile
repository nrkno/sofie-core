@Library('sofie-jenkins-lib') _

pipeline {
  agent any
  stages {
    stage('Build image') {
      steps {
          dockerBuild('sofie/tv-automation-server-core')
      }
    }
  }
}
