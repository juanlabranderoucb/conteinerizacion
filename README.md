# Ticketing (Microservicios) - Trabajo Final Conteinerización y Orquestación de Contenedores

JUAN CARLOS LABRANDERO CERVANTES

Este repositorio contiene una aplicación de ejemplo basada en microservicios para la venta y gestión de tickets. Es la versión del proyecto "Ticketing" utilizada en cursos prácticos y está diseñada para demostrar patrones de arquitectura de microservicios, comunicación por eventos y despliegue con contenedores Docker Swarm y Kubernetes.

## Visión general

La aplicación permite crear y gestionar tickets, realizar pedidos, procesar pagos y manejar autenticación de usuarios. Está compuesta por varios servicios independientes que se comunican a través de un sistema de mensajería (NATS) y usan bases de datos propias (MongoDB). También incluye un cliente Next.js que consume las APIs de los microservicios.

## Servicios incluidos

- `auth` — Servicio de autenticación (registro, inicio/cierre de sesión, current-user).
- `tickets` — Servicio para crear/editar/listar tickets.
- `orders` — Servicio que administra pedidos creados por usuarios.
- `payments` — Servicio que procesa pagos (integra Stripe en modo de prueba/mock).
- `expiration` — Servicio que administra expiración de pedidos usando colas/temporizadores.
- `client` — Aplicación frontend en Next.js para interactuar con los microservicios.
- `common` — Código compartido (tipos, errores, middlewares, eventos) utilizado por todos los servicios.
- `nats-test` — Utilidades y ejemplos para publicar/escuchar eventos en NATS (útil para pruebas locales).
- `infra` — Archivos de infraestructura: `docker-compose.yml` y manifiestos de Kubernetes (`k8s/`) para despliegues.

Cada servicio está en una carpeta separada con su propio `package.json`, `tsconfig.json` y Dockerfile.

## Arquitectura y comunicación

![Arquitectura y comunicación](assets/diagrama.png)

- Comunicación síncrona: HTTP (Express) entre cliente y cada microservicio.
- Comunicación asíncrona: NATS Streaming / JetStream para eventos entre servicios (p.ej., creación de ticket, orden creada, pago realizado).
- Persistencia: MongoDB por servicio (cada microservicio tiene su propia base de datos en despliegue). Algunos despliegues de ejemplo incluyen pods/instancias MongoDB separados.
- Cache/Colas/TTL: Redis se usa en el servicio `expiration` (y en infra) para gestión de expiraciones y colas en ejemplos.

## Tecnologías

- Node.js + TypeScript
- Express
- MongoDB
- NATS (mensajería de eventos)
- Redis (para tasks/expiration en despliegues de ejemplo)
- Next.js (frontend)
- Docker / Docker Swarm
- Kubernetes (manifiestos en `infra/k8s/`)

# Despliegue con Docker Swarm

Las imagenes fueron publicadas en: https://hub.docker.com/repositories/jcharlylc

## Requisitos

- Docker Engine (con soporte Swarm) instalado en la(s) máquinas que formarán el clúster.
- Acceso a una terminal con permisos para ejecutar comandos docker.
- (Opcional) Un archivo `.env` con variables de entorno usadas por `infra/docker-compose.yml` (URIs de Mongo, credenciales, claves de Stripe en modo prueba, etc.).

## Inicializar Swarm (si no está iniciado)

En la máquina que actuará como manager:

```sh
# Inicializar el swarm
docker swarm init --advertise-addr <MANAGER-IP>

# Obtener el token para unir workers (ejemplo)
docker swarm join-token worker
```

Sigue las instrucciones que imprime `docker swarm join-token` en las otras máquinas para unir nodos al clúster.

## Redes

Docker Swarm usa redes overlay para la comunicación entre servicios distribuidos. Puedes crear una red overlay si deseas controlar su nombre explícitamente, aunque `docker stack deploy` creará redes a partir del `docker-compose.yml` si están declaradas.

```sh
# Crear una red overlay (opcional)
docker network create --driver overlay ticketing-net
```

## Desplegar la pila

Desde la raíz del repo (o desde `infra/`), usa `docker stack deploy` con el archivo `docker-compose.yml` del directorio `infra`:

```sh
# Desde la raíz del proyecto
cd infra

# (Opcional) exportar variables de entorno o crear un .env con las variables necesarias
# export MONGO_URI=... etc.

# Desplegar la pila
docker stack deploy -c docker-compose.yml ticketing
```

Este comando crea servicios gestionados por Swarm basados en las definiciones del `docker-compose.yml`.

## Variables de entorno y secretos

- Si tu `docker-compose.yml` depende de variables (por ejemplo URIs Mongo, claves de Stripe), puedes proporcionarlas con un archivo `.env` en el mismo directorio o usando `docker config`/`docker secret` para valores sensibles.

Ejemplo de uso de secrets:

```sh
# Crear un secret con la clave de Stripe
echo "sk_test_..." | docker secret create stripe_secret -

# En el compose, referencia el secret en los servicios que lo requieran
```

Usa `docker secret` y `docker config` para proteger credenciales en producción.

## Escalado y actualizaciones

Para escalar un servicio:

```sh
# Escalar el servicio web a 3 réplicas
docker service scale ticketing_service_name=3
```

Para actualizar la imagen de un servicio con despliegue continuo:

```sh
# Empujar nueva imagen al registry y actualizar el servicio
docker service update --image myrepo/service:tag ticketing_service_name
```

Swarm soporta políticas de update y rollback mediante las opciones `deploy.update_config` y `deploy.rollback_config` en el `docker-compose.yml` (versión 3.x).

## Comandos útiles de administración

```sh
# Ver servicios creados por la stack
docker stack services ticketing

# Ver tareas/instancias de un servicio
docker stack ps ticketing

# Ver logs (de todos los servicios o filtrando por servicio)
docker service logs ticketing_service_name --follow

# Ver el estado del swarm
docker node ls
```

## Eliminando la stack

```sh
docker stack rm ticketing
```

## Ejemplo rápido (resumen)

```sh
# 1) Inicializar swarm (si es necesario)
docker swarm init --advertise-addr 192.0.2.10

# 2) Crear secrets/configs si son necesarios
echo "sk_test_xxx" | docker secret create stripe_secret -

# 3) Desplegar
cd infra
docker stack deploy -c docker-compose.yml ticketing

# 4) Ver estado
docker stack services ticketing
docker service logs ticketing_auth -f
```

# Despliqgue con Kubernetes

Los manifiestos para desplegar la aplicación están bajo `infra/k8s/`. Contienen despliegues y servicios para cada microservicio y componentes infra (Mongo, NATS, Redis, Ingress). Hay subcarpetas y variantes para entornos de desarrollo y producción (`k8s-dev/`, `k8s-prod/`).

A continuación se incluyen instrucciones prácticas para desplegar y operar la aplicación en Kubernetes.

### Requisitos

- Un clúster Kubernetes accesible (minikube, kind, k3s, GKE, EKS, AKS, etc.).
- `kubectl` configurado con el contexto apuntando al clúster deseado.
- (Opcional) `helm` si prefieres gestionar dependencias con charts.

### Desplegar (modo rápido)

Desde la raíz del repositorio aplica los manifiestos del directorio `infra/k8s/`:

```sh
# Aplica todos los manifiestos (puedes usar k8s-dev/ o k8s-prod/ según el entorno)
kubectl apply -f infra/k8s/

# O si quieres aplicar una carpeta específica para desarrollo:
kubectl apply -f infra/k8s/k8s-dev/
```

Esto creará Namespaces, Deployments, Services y recursos necesarios según los YAML incluidos.

### Namespaces y contexto

Es buena práctica desplegar en un `namespace` dedicado (por ejemplo `ticketing`). Si los manifiestos no lo crean automáticamente, puedes crear uno y usarlo:

```sh
kubectl create namespace ticketing
kubectl config set-context --current --namespace=ticketing
```

O pasar `-n ticketing` en los comandos `kubectl`.

### Secrets y configuraciones sensibles

Antes de aplicar los manifiestos, crea los `Secrets` necesarios (p. ej. claves de Stripe, URIs privadas). Ejemplo:

```sh
# Stripe
kubectl -n ticketing create secret generic stripe-secret --from-literal=STRIPE_KEY=sk_test_xxx

# URI Mongo (si no usas un servicio gestionado fuera del cluster)
kubectl -n ticketing create secret generic mongo-secret --from-literal=MONGO_URI=mongodb://user:pass@mongo-svc:27017
```

Los manifiestos pueden leer estos secrets mediante variables de entorno en los containers.

### Verificar estado y logs

Comprueba que los pods estén corriendo:

```sh
kubectl -n ticketing get pods
kubectl -n ticketing get deployments,services
kubectl -n ticketing logs deploy/auth -c <container-name>   # ejemplo: ver logs del deployment auth
kubectl -n ticketing describe pod <pod-name>                # investigar eventos/errores
```

Si necesitas exponer un servicio localmente para pruebas, usa port-forward:

```sh
kubectl -n ticketing port-forward svc/auth 3000:3000
# Luego accede a http://localhost:3000
```

### Ingress

Los manifiestos incluyen definición de `Ingress` en `infra/k8s/`. Asegúrate de que tu clúster tenga un Ingress Controller (NGINX, Traefik, cloud provider). Para minikube puedes habilitar `ingress` addon o instalar un controlador.

Ver el estado del ingress:

```sh
kubectl -n ticketing get ingress
kubectl -n ticketing describe ingress <ingress-name>
```

Nota: en entornos cloud, el Ingress puede crear un LoadBalancer externo y una IP pública.

### Escalado y actualizaciones (rollouts)

Para escalar un deployment:

```sh
kubectl -n ticketing scale deployment tickets --replicas=3
```

Para actualizar la imagen y hacer rollout:

```sh
kubectl -n ticketing set image deployment/orders orders=myrepo/orders:latest
kubectl -n ticketing rollout status deployment/orders
kubectl -n ticketing rollout history deployment/orders
```

Si un rollout falla, puedes hacer rollback:

```sh
kubectl -n ticketing rollout undo deployment/orders
```

### Volúmenes y persistencia

Los manifiestos incluyen PersistentVolumeClaims para MongoDB cuando procede. En clusters locales (minikube/kind) asegúrate de que hay una provisión dinámica o crea PersistentVolumes manualmente.

### Despliegue con Helm (opcional)

Si quieres empaquetar los servicios como charts, puedes crear charts por servicio o utilizar uno monolítico que despliegue la aplicación completa. Helm facilita parametrizar imágenes, réplicas y secrets.

### Eliminando la aplicación

```sh
kubectl -n ticketing delete -f infra/k8s/
# o eliminar el namespace (elimina todo lo desplegado dentro)
kubectl delete namespace ticketing
```

### Troubleshooting rápido

- `kubectl get events -n ticketing` para ver errores de scheduling o volúmenes.
- Si un pod entra en `CrashLoopBackOff`, inspecciona los logs: `kubectl logs -n ticketing <pod> --previous`.
- Revisa `kubectl describe` en pods y deployments para ver condiciones y eventos.

### Despliegue con kubeadm (crear un clúster manual)

Si quieres crear tu propio clúster Kubernetes usando `kubeadm`, aquí tienes pasos básicos y consideraciones. Estas instrucciones asumen acceso SSH a las máquinas que actúan como control-plane y nodos worker.

1) Preparar las máquinas

- Instala Docker (o containerd) en cada nodo.
- Deshabilita swap y asegúrate de que las máquinas pueden resolverse por IP/hostname.

2) Inicializar el control-plane

En la máquina que será el control-plane (master):

```sh
# Inicializar kubeadm y generar el token de join
sudo kubeadm init --pod-network-cidr=192.168.0.0/16

# Configurar kubectl para el usuario actual
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

El comando `kubeadm init` imprimirá un comando `kubeadm join ... --token ...` que usarás en los workers.

3) Instalar un CNI (red de pods)

Instala una solución CNI compatible (por ejemplo Calico, Flannel o Weave). Por ejemplo, para Calico:

```sh
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml
```

4) Unir nodos worker

En cada nodo worker ejecuta el comando `kubeadm join` que te devolvió el control-plane (o recupera el token con `kubeadm token create --print-join-command` en el control-plane).

5) Verificar el clúster

```sh
kubectl get nodes
kubectl get pods --all-namespaces
```

6) Preparar imágenes y registros (opcional)

- Si no tienes acceso a un registry público, sube las imágenes de tus servicios a un registry accesible por todos los nodos o carga las imágenes directamente en cada nodo (por ejemplo con `ctr` o `docker save|load`). También puedes desplegar un registry privado dentro del clúster.

7) Crear namespace y secrets

```sh
kubectl create namespace ticketing
kubectl -n ticketing create secret generic stripe-secret --from-literal=STRIPE_KEY=sk_test_xxx
kubectl -n ticketing create secret generic mongo-secret --from-literal=MONGO_URI=mongodb://user:pass@mongo-svc:27017
```

8) Desplegar los manifiestos del proyecto

```sh
kubectl -n ticketing apply -f infra/k8s/k8s-dev/
```

9) Ingress y balanceo

- Instala un Ingress Controller (NGINX, Traefik, etc.) si aún no lo tienes. En entornos HA considera un LoadBalancer externo delante de los control-planes o un controlador tipo MetalLB para entornos on-prem.

10) Notas operacionales y seguridad

- Para producción con `kubeadm` considera:
	- HA del control-plane (multiple control-planes con un LoadBalancer frente a ellos).
	- Cert-manager para rotación de certificados si es necesario.
	- Usar `kubectl apply --server-side` y herramientas CI/CD para deployments.
	- Gestionar backups de etcd (fundamental para recuperaciones del clúster).

11) Limpieza

Para eliminar todo lo desplegado por los manifiestos del proyecto:

```sh
kubectl -n ticketing delete -f infra/k8s/k8s-dev/
kubectl delete namespace ticketing
```

## Capturas de pantalla


![Captura 1 — Lista de tickets](assets/cp1.png)

![Captura 2 — Crear ticket](assets/cp2.png)

![Captura 3 — Detalle de ticket / crear orden](assets/cp3.png)

![Captura 4 — Página de órdenes](assets/cp4.png)

![Captura 5 — Pagos / confirmación](assets/cp5.png)
