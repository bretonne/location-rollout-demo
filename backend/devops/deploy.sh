#!/bin/bash
set -e

APP_NAME="location-rollout-api"
CLUSTER_NAME="demo-cluster"
NAMESPACE="kubecon-demo"

# Build Docker image
docker build -t ${APP_NAME}:latest ../

kind load docker-image ${APP_NAME}:latest --name ${CLUSTER_NAME}

kubectl apply -n ${NAMESPACE} -f ../k8s/api-deploy.yaml

echo "✅ Backend API deployed successfully to namespace ${NAMESPACE} in cluster ${CLUSTER_NAME}"



