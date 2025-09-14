# location-rollout-demo
Deploy UI, API, hello v1/v2 + service (reuse your existing hello deploys with app: hello, version: v1|v2)

kubectl apply -f k8s/istio.yaml

/etc/hosts: 127.0.0.1 demo.local

# Verify that service is running
```
kubectl -n istio-system port-forward svc/istio-ingressgateway 8080:80
```
Open http://demo.local:8080/


Run rollout: ./scripts/rollout.sh "20,40,60,80,100" 60

That’s it—your UI will poll every minute and fetch /hello with the header x-software-route set to each machine’s assigned route; Istio routes to v1/v2 accordingly.


## Troubleshooting
If for any reason it is not working, then first check if service side works.
```
kubectl port-forward svc/api 8080:8080 -n kubecon-demo
```
Then curl:
```
curl http://localhost:8080/api/machines
```
Or use Bruno to do a GET on http://localhost:8080/api/machines

