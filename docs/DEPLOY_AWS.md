# Deploy Listen Later to AWS (beginner console walkthrough)

This guide assumes you have **never deployed to AWS before**. It tells you **where to go in the AWS website (console)**, **what to click**, and **what to type** for a full stack deployment:

- **React/Vite** frontend → **S3** + **CloudFront**
- **Express API** → **ECS Fargate** behind an **Application Load Balancer (ALB)**
- **PostgreSQL** → **Amazon RDS**

You will use **one domain name** (for example `listenlater.example.com`) so the browser, cookies, and `/api` calls all share the same site. That matches how this app is built (`/api` on the same host).

> **Important:** AWS changes small labels and layouts over time. If a button name differs slightly (for example **Create** vs **Create resource**), use the closest match. The **search box** at the top of the console is the fastest way to open any service.

---

## How to use this guide

1. **Pick one AWS Region** and use it for everything except where this guide says otherwise. This walkthrough uses **US East (N. Virginia)** — API name **`us-east-1`**.  
   - In the console **top bar**, click the **Region** dropdown (it shows something like “United States (N. Virginia)” or a city name) and select **us-east-1**.  
   - **Write down** that you are using `us-east-1`. If you pick a different region, substitute it everywhere below (except the CloudFront certificate step, which is special).

2. **Do the phases in order.** Later steps depend on earlier ones (VPC → RDS → ALB → ECS → S3 → CloudFront).

3. **This repo has no Dockerfile yet.** Before you can run the API on ECS, you (or a follow-up change) need a working `Dockerfile` and a pushed image to **ECR**. This guide still shows every **console** click for ECR/ECS; the Docker part is summarized at the end.

4. **Costs:** A NAT Gateway alone is often **on the order of tens of dollars per month**. This guide includes a **budget-saving option** (Fargate in a public subnet for learning) and calls out where money adds up.

---

## Part A — AWS account and console basics

### A1. Create or sign in to AWS

1. Open [https://aws.amazon.com/](https://aws.amazon.com/) and sign in to the **AWS Management Console** (not the marketing homepage).
2. If this is a brand-new account, complete email verification and **choose “Personal” or “Professional”** as prompted.
3. You will need a **payment method** on file. AWS has a Free Tier for some services for 12 months; **not everything in this guide is free tier**. Set a **billing alarm** (next section).

### A2. Set a billing alarm (strongly recommended)

1. In the **top search bar**, type **`Billing`** and open **Billing and Cost Management**.
2. In the left sidebar, click **Budgets** (or search **Budgets** from the top search).
3. Click **Create budget** → choose **Use a template (simplified)** → template **Monthly cost budget**.
4. Set an amount you are comfortable with (for example **50** USD), enter your email for alerts, and finish the wizard.

### A3. Avoid using the “root” user every day (optional but good practice)

1. In the top search bar, type **`IAM`** and open **IAM**.
2. Left sidebar: **Users** → **Create user**.  
3. User name: for example `console-admin`. Enable **AWS Management Console access**, set a password.  
4. Attach policy **AdministratorAccess** for learning (narrow permissions later for production).  
5. Sign out of root and sign in as this IAM user for the rest of the guide.

### A4. How to open any service

- Use the **search box** at the top (magnifying glass): type **VPC**, **RDS**, **S3**, etc., then click the service under **Services**.

### A5. TLS certificate region (CloudFront rule)

**CloudFront** only uses ACM certificates from **US East (N. Virginia) `us-east-1`**.  
If your app runs in `us-east-1`, you request **one** certificate there and can use it for **both** CloudFront and an ALB in the same region.  
If your app runs in **another** region (for example `eu-west-1`), you still need a **second** certificate in `us-east-1` **only for CloudFront**; the ALB uses a certificate in **its** region.

This guide assumes **everything is in `us-east-1`** so **one certificate** is enough.

---

## Part B — Request an SSL certificate (ACM)

You need HTTPS for your domain before users can use `https://yoursite...`.

1. **Confirm region:** top bar → **US East (N. Virginia) us-east-1**.
2. Search **`Certificate Manager`** or **`ACM`** → open **AWS Certificate Manager**.
3. If you see “Get started”, continue; otherwise click **Request certificate**.
4. Choose **Request a public certificate** → **Next**.
5. **Domain names:**  
   - Add your apex domain, for example `example.com`.  
   - Optionally add a wildcard `*.example.com` **or** explicitly add `listenlater.example.com` (whatever you will use in the browser).  
6. **Validation method:** **DNS validation** (recommended).  
7. **Key algorithm:** default (RSA 2048) is fine → **Request**.

After creation, you will see the certificate **Pending validation**.

8. Click the **certificate ID** link to open it.
9. Under **Domains**, for each domain, click **Create records in Route 53** if your DNS is in Route 53 (easiest).  
   - If your DNS is at another registrar, click **Create CNAME record** and copy the **CNAME name** and **CNAME value** into your DNS provider’s panel.

Wait until the status becomes **Issued** (can take a few minutes after DNS propagates).

---

## Part C — Create the network (VPC)

You need a VPC with **public subnets** (for the load balancer) and **private subnets** (typical for RDS and Fargate). The **VPC wizard** is the fastest way.

1. Search **`VPC`** → open **VPC**.
2. Top right: confirm region **us-east-1**.
3. In the **left sidebar**, click **Your VPCs** (or start from **VPC dashboard**).
4. Click **Create VPC** (orange button).
5. Select **VPC and more** (this creates subnets, routing, and NAT in one flow).
6. Suggested settings for learning:
   - **Name tag auto-generation:** enter a prefix, for example `listenlater`.
   - **IPv4 CIDR block:** default `10.0.0.0/16` is fine.
   - **Number of Availability Zones:** **2**.
   - **Number of public subnets:** **2**.
   - **Number of private subnets:** **2**.
   - **NAT gateways:**  
     - **1 per AZ** = more reliable, **costs more**.  
     - **In 1 AZ** = cheaper for experiments.  
     - **None** = see the callout below if you want to avoid NAT entirely for a first deploy.
   - **VPC endpoints:** optional for this guide; **S3 Gateway** is free and can reduce NAT traffic if you add it.
7. Click **Create VPC**. Wait until status shows **Available**.

> **Budget note — NAT Gateway:** Each NAT Gateway has an hourly charge plus data processing. For a **first learning deploy**, some people run **Fargate tasks with a public IP in a public subnet** and **no NAT** to save money. That is **less isolated** than private subnets + NAT. If you choose **no NAT**, place **both** the ALB and Fargate in **public subnets** and ensure security groups still only allow ALB → tasks on the app port.

### Write down these IDs (you will paste them later)

1. Left sidebar → **Subnets**.  
2. Filter by your VPC name (for example `listenlater-vpc`).  
3. Note **two public subnet IDs** (names often contain `public`) and **two private subnet IDs** (often `private`).  
4. Left sidebar → **Your VPCs** → note the **VPC ID** (starts with `vpc-`).

---

## Part D — Security groups (firewall rules)

You will create **three** security groups in **EC2** (security groups live under EC2 even for RDS).

1. Search **`EC2`** → open **EC2**.
2. Confirm region **us-east-1**.
3. Left sidebar → **Security Groups** → **Create security group**.

### D1. Security group for the load balancer (`sg-alb`)

- **Security group name:** `listenlater-alb-sg`
- **Description:** HTTP/HTTPS from internet
- **VPC:** select your new VPC
- **Inbound rules:**  
  - **Add rule:** Type **HTTP**, Source **Anywhere-IPv4** `0.0.0.0/0`  
  - **Add rule:** Type **HTTPS**, Source **Anywhere-IPv4** `0.0.0.0/0`  
- **Outbound rules:** leave default (all traffic)
- Click **Create security group**

### D2. Security group for the API tasks (`sg-api`)

- **Name:** `listenlater-api-sg`
- **VPC:** same VPC
- **Inbound rules:**  
  - **Add rule:** Type **Custom TCP**, Port **8080** (or whatever port your container uses — must match later), Source: **Custom** → in the box, select the security group **`listenlater-alb-sg`** (search by name). This means **only the load balancer** can reach the app.  
- **Outbound:** default  
- **Create security group**

### D3. Security group for RDS (`sg-rds`)

- **Name:** `listenlater-rds-sg`
- **VPC:** same VPC
- **Inbound rules:**  
  - **Add rule:** Type **PostgreSQL** (port 5432), Source: select **`listenlater-api-sg`**.  
- **Outbound:** default  
- **Create security group**

> **First-time database setup:** Until your ECS service exists, you may need to **temporarily** add an inbound rule on `sg-rds`: PostgreSQL from **My IP** (there is a “My IP” shortcut in the Source dropdown) so you can run `schema.sql` from your laptop. **Remove that rule** after migration, or restrict it aggressively.

---

## Part E — Create the database (RDS PostgreSQL)

1. Search **`RDS`** → open **RDS**.
2. Confirm **us-east-1**.
3. Left sidebar → **Subnet groups** → **Create DB subnet group**.
   - **Name:** `listenlater-db-subnets`
   - **VPC:** your VPC
   - **Availability Zones:** pick the **two** AZs that contain your **private** subnets (hold Ctrl/Cmd to select two).
   - **Subnets:** select **only private subnets** from that VPC (two subnets).
   - **Create**

4. Left sidebar → **Databases** → **Create database**.

**Engine options**

- **Engine type:** **PostgreSQL**
- **Engine version:** **16.x** (or latest 16 offered)

**Templates**

- For learning: **Free tier** if available; otherwise **Dev/Test**.

**Settings**

- **DB instance identifier:** `listenlater-db`
- **Master username:** for example `postgres` (or another name; write it down)
- **Master password:** generate a strong password and **save it** in a password manager.

**Instance configuration**

- **DB instance class:** **db.t4g.micro** or **db.t3.micro** (small/cheap).

**Storage**

- Defaults are usually fine for a first app.

**Connectivity**

- **VPC:** your VPC
- **DB subnet group:** `listenlater-db-subnets`
- **Public access:** **No** (recommended). If you use **Yes** for easier first-time `psql` from home, **only** with `sg-rds` locked to your IP — not for production.
- **VPC security group:** choose **Choose existing** → select **`listenlater-rds-sg`**
- **Availability Zone:** optional; default is fine.

**Database authentication:** **Password authentication**.

**Additional configuration** (expand if collapsed)

- **Initial database name:** `listen_later` (matches local `docker-compose` convention) or another name — if you omit this, note the default database name AWS shows.
- **Backup** / **encryption:** defaults are fine to start.

Click **Create database**. Provisioning often takes **10–20 minutes**.

### Get the RDS endpoint

1. When status is **Available**, open the database → **Connectivity & security**.  
2. Copy the **Endpoint** (hostname, **without** the port).  
3. Your `DATABASE_URL` will look like:  
   `postgresql://USERNAME:PASSWORD@endpoint:5432/DATABASE_NAME`  
   Add SSL if you enable it on RDS (`?sslmode=require`).

### Apply `schema.sql`

From a machine that can reach RDS (your IP allowed temporarily, bastion, or VPN):

```bash
psql "postgresql://USER:PASS@ENDPOINT:5432/DATABASE" -f server/src/db/schema.sql
```

(On Windows you may install PostgreSQL client tools or use WSL.)

---

## Part F — Store secrets (Secrets Manager)

1. Search **`Secrets Manager`** → **Store a new secret**.
2. **Secret type:** **Other type of secret** → **Key/value**:
   - Key `DATABASE_URL`, value = your full connection string.
   - Add another key `SESSION_SECRET`, value = long random string.
   - Add `LASTFM_API_KEY` if needed.
3. **Secret name:** `listenlater/app` (example) → **Next** → **Next** → **Store**.

You will reference this secret from the ECS task definition.

---

## Part G — Container registry (ECR)

1. Search **`ECR`** → **Amazon Elastic Container Registry**.
2. **us-east-1**.
3. Left: **Repositories** → **Create repository**.
   - **Visibility:** Private
   - **Repository name:** `listenlater-api`
   - **Create repository**

### Push an image (summary; requires Docker on your PC)

On your computer (after you have a Dockerfile and `docker` installed):

1. In the ECR repository page, click **View push commands**.  
2. AWS shows **exact** login/build/tag/push commands for your account and region. Run them in order in a terminal.

Until that image exists, ECS cannot start your service.

---

## Part H — IAM roles for ECS

ECS needs **two** roles:

1. **Task execution role** — pulls image from ECR, reads secrets, writes logs.  
2. **Task role** — optional permissions **inside** your app (often not needed for this API).

### H1. Task execution role

1. Search **`IAM`** → **Roles** → **Create role**.
2. **Trusted entity:** **AWS service** → use case **Elastic Container Service** → select **Elastic Container Service Task** → **Next**.
3. Some consoles split this: pick **Elastic Container Service Task**, then for use case pick **ECS Task** and later attach **AmazonECSTaskExecutionRolePolicy**.  
   - If you see **Elastic Container Service** → **EC2** vs **Fargate**, choose the path for **Fargate / task execution**.  
4. Attach policy **`AmazonECSTaskExecutionRolePolicy`**.
5. **Role name:** `ecsTaskExecutionRole` (or any name; write it down) → **Create role**.

### H2. Allow reading your secret (execution role)

1. Open the role you just created.
2. **Add permissions** → **Create inline policy** → **JSON** and paste a policy like (replace region, account ID, and secret ARN):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:listenlater/app-*"
    }
  ]
}
```

To find **account ID**: top-right account menu → **Account** (12-digit number).  
Secret ARN: Secrets Manager → click your secret → copy **ARN**.

Name the inline policy `ReadListenLaterSecrets` → **Create policy**.

---

## Part I — Load balancer target group and ALB

### I1. Target group (empty at first)

1. **EC2** console → left sidebar **Target Groups** → **Create target group**.
2. **Target type:** **IP addresses** (for Fargate).
3. **Protocol : Port:** **HTTP** and **8080** (must match container `PORT`).
4. **VPC:** your VPC.
5. **Protocol version:** HTTP1.
6. **Health checks:**  
   - **Health check path:** `/health`  
   - Success codes: `200` (default).
7. **Register targets:** skip for now (no tasks yet) → **Create target group**.

Name it something like `listenlater-api-tg`.

### I2. Application Load Balancer

1. **EC2** → **Load Balancers** → **Create Load Balancer** → **Application Load Balancer** → **Create**.
2. **Name:** `listenlater-alb`
3. **Scheme:** **Internet-facing**
4. **IP address type:** **IPv4**
5. **VPC:** your VPC
6. **Mappings:** enable **two AZs** and select **one public subnet per AZ** (checkboxes).
7. **Security groups:** **`listenlater-alb-sg`**
8. **Listeners:**  
   - **HTTPS : 443** → **Forward to** → select **`listenlater-api-tg`**.  
   - Under **Default SSL certificate**, choose **From ACM** and pick your **issued** certificate.  
9. **Add listener** (optional but useful): **HTTP : 80** → **Redirect to** **HTTPS : 443** (443) — the console offers a redirect wizard.
10. **Create load balancer**.

When **State** is **active**, open the **DNS name** (looks like `listenlater-alb-123.us-east-1.elb.amazonaws.com`). It will **not** serve your app yet until ECS registers healthy targets.

---

## Part J — ECS cluster, task definition, and service

### J1. Cluster

1. Search **`ECS`** → **Amazon Elastic Container Service**.
2. **us-east-1**.
3. Left → **Clusters** → **Create cluster**.
4. **Cluster name:** `listenlater`
5. **Infrastructure:** **AWS Fargate (serverless)** only (uncheck EC2 if shown).
6. **Create**.

### J2. Task definition

1. Left → **Task definitions** → **Create new task definition**.
2. **Task definition family:** `listenlater-api`
3. **Launch type:** **Fargate**
4. **OS/Architecture:** Linux/X86_64 or ARM64 (must match the image you built).
5. **Task size:** **1 vCPU**, **2 GB** (minimum reasonable for Node; increase if OOM).
6. **Task execution role:** the role from Part H (`ecsTaskExecutionRole`).
7. **Task role:** optional **none** for now.

**Container — Add container**

- **Name:** `api`
- **Image URI:** paste the ECR image URI (Repository URI shown in ECR + tag, for example `...amazonaws.com/listenlater-api:latest`).
- **Port mappings:** container port **8080**, protocol **TCP** (must match target group).

**Environment variables / secrets**

- Under **Environment variables**, add plain vars:
  - `NODE_ENV` = `production`
  - `PORT` = `8080`
  - `FRONTEND_URL` = `https://your-subdomain.example.com` (your **final** browser URL — same as CloudFront domain later)

- Under **Secrets** (optional UI) or environment from Secrets Manager (depends on console version):  
  - Map `DATABASE_URL` from Secrets Manager key.  
  - Map `SESSION_SECRET` similarly.  
  (If the UI only allows full secret JSON, you may inject via **secretOptions** in the task JSON, or split into separate secrets per value — simplest for beginners: store **one secret per variable** in Secrets Manager.)

Click **Create**.

### J3. Service

1. Open **Clusters** → **`listenlater`** → **Services** tab → **Create**.
2. **Launch type:** **Fargate**
3. **Task definition:** latest `listenlater-api`
4. **Service name:** `listenlater-api-svc`
5. **Desired tasks:** **1**
6. **VPC:** your VPC
7. **Subnets:**  
   - **Private subnets** + NAT: select **private** subnets, **Assign public IP: DISABLED**.  
   - **No NAT / learning:** select **public** subnets, **Assign public IP: ENABLED**.
8. **Security group:** **`listenlater-api-sg`**
9. **Load balancing:** **Application Load Balancer** → pick **`listenlater-alb`** → **Production listener : HTTPS:443** → **Target group** `listenlater-api-tg`
10. **Health check grace period:** 60–120 seconds
11. **Create**

Wait until **Running count** = **1** and the target group shows **healthy**.

**Test the ALB directly (before CloudFront):**

- Visit `https://listenlater-alb-xxxxx.elb.amazonaws.com/health`  
- You may need to **temporarily** use the HTTP listener or allow the ALB DNS in the certificate (wildcard helps). For a quick test, **HTTP listener** forwarding to the target group can work — **remove for production** or enforce HTTPS only.

---

## Part K — Frontend bucket (S3)

1. Search **`S3`** → **Create bucket**.
2. **Bucket name:** globally unique, for example `listenlater-frontend-yourname`
3. **Region:** **us-east-1**
4. **Block Public Access:** keep **all blocked** (recommended).
5. **Create bucket**.

### Upload the built site

On your computer:

```bash
cd client
npm run build
```

Upload **everything inside** `client/dist` to the **bucket root** (not the `dist` folder name itself as a single object). In the console: open the bucket → **Upload** → **Add files** / **Add folder**.

---

## Part L — CloudFront distribution

CloudFront sits in front of S3 (static files) and your ALB (`/api`).

### L1. Origin Access Control (OAC)

1. Search **`CloudFront`** → left **Policies** → **Origin access** tab (name may be **Origin access control**).
2. **Create control setting**:
   - **Sign requests:** **Yes** (recommended OAC)
   - **Origin type:** **S3**
   - **Name:** `listenlater-s3-oac`
   - Create and note the **OAC** you created.

### L2. Update S3 bucket policy

CloudFront will show a **Copy policy** button after you attach OAC to the origin. Apply that **bucket policy** on the S3 bucket **Permissions** tab so CloudFront can read objects.

### L3. Create distribution

1. **CloudFront** → **Create distribution**.

**Origin 1 (S3)**

- **Origin domain:** pick your bucket **from the dropdown** (do not use the website endpoint unless you know you need it).
- **Origin access:** **Origin access control** → select **`listenlater-s3-oac`**.  
- Allow CloudFront to **update the bucket policy** when prompted.

**Origin 2 (ALB)**

- **Add origin**:
  - **Origin domain:** paste your **ALB DNS name** (from EC2 → Load balancers).  
  - **Protocol:** **HTTPS only** (ALB has your cert).  
  - **Minimum origin SSL protocol:** TLSv1.2

**Default cache behavior** (usually S3 first)

- **Origin:** your **S3** origin
- **Viewer protocol policy:** **Redirect HTTP to HTTPS**
- **Allowed HTTP methods:** **GET, HEAD, OPTIONS** (or **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** if you ever need methods to S3 — for SPA, GET/HEAD/OPTIONS is typical for static only)

**Add behavior for API**

- **Precedence** lower number = higher priority (console wording varies). Add a behavior:
  - **Path pattern:** `/api/*`
  - **Origin:** your **ALB** origin
  - **Viewer protocol policy:** **Redirect HTTP to HTTPS**
  - **Allowed HTTP methods:** **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE**
  - **Cache policy:** **CachingDisabled** (or a custom policy with **TTL 0**) — **do not cache API responses** by default.
  - **Origin request policy:** choose **AllViewerExceptHostHeader** or a policy that **forwards cookies** and **Authorization** (sessions use cookies). If something fails, try **AllViewer** and troubleshoot host headers (you may need **Custom origin** header overrides — advanced).

**Settings**

- **Alternate domain name (CNAME):** `listenlater.example.com` (your real subdomain)
- **Custom SSL certificate:** select your **ACM cert in us-east-1** (must be **Issued**)
- **Default root object:** optional `index.html`

**Create distribution**. Status **Deployed** can take **15–30+ minutes**.

### SPA routing (React Router)

If users open `/dashboard` directly, S3 may return **403/404**. Common fixes:

- **CloudFront custom error responses:** map **403** and **404** to **200** `/index.html` (SPA fallback), **or**
- **Lambda@Edge / CloudFront Functions** (more advanced).

Add that in **CloudFront** → your distribution → **Error pages** (custom error responses).

---

## Part M — DNS (Route 53)

If your domain is in Route 53:

1. Search **`Route 53`** → **Hosted zones** → your domain.
2. **Create record**:
   - **Record name:** `listenlater` (or `@` for apex)
   - **Record type:** **A** (and optionally **AAAA** for IPv6)
   - **Alias:** enable → **Route traffic to** → **CloudFront distribution** → pick your distribution.
3. **Create records**.

Wait for DNS (sometimes up to an hour; often minutes).

---

## Part N — Final environment alignment

1. **`FRONTEND_URL`** on the server must be exactly **`https://listenlater.example.com`** (no trailing slash unless you consistently use one everywhere).
2. **CORS** in `server/src/index.ts` uses `FRONTEND_URL` — it must match the URL users type in the browser.
3. Open **`https://listenlater.example.com`**, open DevTools → **Network**, confirm `/api/...` calls go to the **same host** and return **200** (or expected auth responses).

---

## Dockerfile reminder (required for ECS)

The API container must:

- Build the server (`npm run build` in the server workspace).
- `EXPOSE` the same port as `PORT` (for example **8080**).
- Run `node dist/index.js`.

Until this exists in the repo and an image is in ECR, **Part G/J** cannot succeed.

---

## If you get stuck (common issues)

| Symptom | Things to check |
|--------|------------------|
| **502/504 from ALB** | Target group: targets **unhealthy**? Security group **alb → api** on correct port? Container **PORT** env matches mapping? |
| **Database connection errors** | `sg-rds` allows **5432** from **`sg-api`**? `DATABASE_URL` host is RDS **endpoint**, user/password correct? |
| **CloudFront shows API but not static** | S3 **bucket policy** + **OAC**; objects uploaded; default behavior origin is S3. |
| **API works on ALB DNS but not custom domain** | Certificate **Alternate domain names**; Route 53 **alias** to CloudFront; distribution **deployed**. |
| **Login/session fails** | Same **site** URL; `NODE_ENV=production` cookies **Secure**; CloudFront forwards **cookies** to ALB. |

---

## Simpler paths (fewer pieces)

If this full stack feels overwhelming for a **first** deploy:

- **Amazon Lightsail** offers simpler **instances** and **managed databases** with fewer screens, but you still configure DNS and HTTPS yourself on the instance or behind a load balancer.
- **AWS Amplify Hosting** can host the **frontend** easily, but **splitting** frontend and API to different origins complicates **cookies** for this app unless you change backend cookie/CORS settings.

The architecture in this guide (CloudFront + S3 + ALB + ECS + RDS) is the **straightforward** way to keep **one domain** for this codebase.

---

## Related project files

- `server/src/db/schema.sql` — run against RDS before the app starts.
- `server/src/index.ts` — CORS, sessions, `/health`.
- `.env.example` — local variable names.
