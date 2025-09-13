# location-rollout-demo
Deploy UI, API, hello v1/v2 + service (reuse your existing hello deploys with app: hello, version: v1|v2)

kubectl apply -f k8s/gw-vs-dr.yaml

/etc/hosts: 127.0.0.1 demo.local

kubectl -n istio-system port-forward svc/istio-ingressgateway 9090:80

Open http://demo.local:9090/

Run rollout: ./scripts/rollout.sh "20,40,60,80,100" 60

That’s it—your UI will poll every minute and fetch /hello with the header x-software-route set to each machine’s assigned route; Istio routes to v1/v2 accordingly.