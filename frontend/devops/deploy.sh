#!/usr/bin/env bash
set -euo pipefail

APP_NAME="location-rollout-ui"
CLUSTER_NAME="demo-cluster"
NAMESPACE="kubecon-demo"

# Base dir (repo/frontend)
BASEDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="${BASEDIR}/VERSION"
K8S_MANIFEST="${BASEDIR}/../k8s/ui-deploy.yaml"

usage() {
  cat <<EOF
Usage: $(basename "$0") [bump [major|minor|patch]]

Commands:
  bump [major|minor|patch]   Increment semantic version in ${VERSION_FILE} (default: patch)

You must set the ROUTE environment variable (e.g. ROUTE=v1 or ROUTE=v2). You can also set VERSION to override the value in ${VERSION_FILE}.
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

COMMON_VERSION_SH="${BASEDIR}/../devops/version.sh"
if [[ -f "${COMMON_VERSION_SH}" ]]; then
  # shellcheck source=/dev/null
  source "${COMMON_VERSION_SH}"
else
  echo "Missing shared version helper: ${COMMON_VERSION_SH}"
  exit 1
fi

# Populate VERSION (accepts: bump [major|minor|patch])
get_current_version "$@"

# ROUTE must be provided via environment (no default)
if [[ -z "${ROUTE:-}" ]]; then
  echo "ERROR: ROUTE environment variable must be set (example: ROUTE=v1 or ROUTE=v2)"
  usage
  exit 1
fi

IMAGE_TAG="${APP_NAME}:${VERSION}"

echo "Building Docker image ${IMAGE_TAG} from ${BASEDIR}..."
docker build -t "${IMAGE_TAG}" "${BASEDIR}"

echo "Loading image into kind cluster ${CLUSTER_NAME}..."
kind load docker-image "${IMAGE_TAG}" --name "${CLUSTER_NAME}"

# Export for envsubst
export VERSION IMAGE_TAG ROUTE

echo "Rendering manifest and applying to namespace ${NAMESPACE}..."
apply_output=$(envsubst '$VERSION $IMAGE_TAG $ROUTE' < "${K8S_MANIFEST}" | kubectl apply -n "${NAMESPACE}" -f - 2>&1 || true)

echo "$apply_output"

# If unchanged, explicitly set image and label so pods pick up the new image
if echo "$apply_output" | grep -q -i "unchanged"; then
  echo "Manifest reported 'unchanged' — updating deployment image and label explicitly..."
  kubectl set image deployment/ui ui="${IMAGE_TAG}" -n "${NAMESPACE}"
  kubectl label deployment/ui version="${VERSION}" route="${ROUTE}" -n "${NAMESPACE}" --overwrite
  kubectl rollout restart deployment/ui -n "${NAMESPACE}"
fi

# Wait for rollout
echo "Waiting for deployment rollout to finish..."
kubectl rollout status deployment/ui -n "${NAMESPACE}" --timeout=120s

echo "✅ Frontend UI deployed to namespace ${NAMESPACE} (version: ${VERSION}, route: ${ROUTE})"
