#!/bin/bash
kubectl delete deploy/api -n kubecon-demo
kubectl delete deploy/ui -n kubecon-demo
kubectl delete svc/api -n kubecon-demo
kubectl delete svc/ui -n kubecon-demo
kubectl delete vs/demo-routes -n kubecon-demo
kubectl delete gateway/demo-gateway -n kubecon-demo
kubectl delete destinationrule/ui -n kubecon-demo