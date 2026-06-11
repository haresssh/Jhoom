# Jhoom AWS ECS Express Mode Deployment Runbook

This runbook provides step-by-step instructions to compile, package, push, and deploy the **Jhoom** application from scratch to a secure **Amazon ECS Express Mode** service and an **Amazon RDS PostgreSQL** database.

---

## Prerequisites
Ensure the following tools are installed and configured on your local system:
1. **AWS CLI** (configured with admin access to your AWS account)
2. **Docker** (running locally)
3. **Java 17 & Maven** (to compile the Spring Boot backend)
4. **Node.js & npm** (to build the React frontend)

---

## Step 1: Compile and Push the Docker Image

The application uses a unified multi-stage [Dockerfile](file:///Users/hareshprajapati/dev/video-collaboration-platform/Dockerfile) at the root directory which builds both the frontend static assets and the Spring Boot JAR, then packages them into a lightweight Temurin JRE runtime.

1. **Create the ECR Repository:**
   ```bash
   aws ecr create-repository --repository-name jhoom-app --region us-east-1
   ```

2. **Log into Amazon ECR:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
   ```

3. **Build the Docker Image (Cross-Compiling for Fargate x86_64):**
   *Note: Since Fargate runs on x86_64, you must specify the `--platform linux/amd64` flag if you are building from an Apple Silicon Mac.*
   ```bash
   cd /Users/hareshprajapati/dev/video-collaboration-platform
   docker build --platform linux/amd64 -t jhoom-app .
   ```

4. **Tag and Push the Image:**
   ```bash
   docker tag jhoom-app:latest <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/jhoom-app:latest
   docker push <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/jhoom-app:latest
   ```

---

## Step 2: Provision Amazon RDS PostgreSQL

1. **Launch the RDS PostgreSQL Database Instance:**
   ```bash
   aws rds create-db-instance \
     --db-instance-identifier jhoom-db \
     --db-instance-class db.t3.micro \
     --engine postgres \
     --master-username postgres \
     --master-user-password postgrespassword123 \
     --allocated-storage 20 \
     --publicly-accessible \
     --region us-east-1 \
     --no-cli-pager
   ```

2. **Wait for the Database to Become Available:**
   ```bash
   aws rds wait db-instance-exists --db-instance-identifier jhoom-db --region us-east-1
   ```
   *Verify availability and retrieve the database hostname:*
   ```bash
   aws rds describe-db-instances --db-instance-identifier jhoom-db --query "DBInstances[0].Endpoint.Address" --output text
   ```
   *(Expected hostname format: `jhoom-db.cu9gggy6evtp.us-east-1.rds.amazonaws.com`)*

3. **Configure Security Group Inbound Rules:**
   Authorize inbound TCP port `5432` on the default VPC security group to allow connections to the database from the internet and the ECS tasks:
   ```bash
   aws ec2 authorize-security-group-ingress \
     --group-id <RDS_SECURITY_GROUP_ID> \
     --protocol tcp \
     --port 5432 \
     --cidr 0.0.0.0/0 \
     --region us-east-1
   ```

---

## Step 3: Deploy the ECS Express Mode Service

1. **Create the ECS Cluster:**
   ```bash
   aws ecs create-cluster --cluster jhoom-cluster --region us-east-1
   ```

2. **Prepare the ECS Ingress Security Group:**
   If you need to recreate the security group for your ECS tasks (allowing inbound traffic to container port 8080):
   ```bash
   aws ec2 create-security-group \
     --group-name jhoom-ecs-sg \
     --description "Security group for Jhoom ECS tasks" \
     --vpc-id <VPC_ID> \
     --region us-east-1
   ```
   *Note the new Group ID (e.g. `sg-0ada9764312ee245f`) and authorize ingress to port 8080:*
   ```bash
   aws ec2 authorize-security-group-ingress \
     --group-id <new-security-group-id> \
     --protocol tcp \
     --port 8080 \
     --cidr 0.0.0.0/0 \
     --region us-east-1
   ```

3. **Review/Update Configuration File:**
   Open and verify that `/Users/hareshprajapati/dev/video-collaboration-platform/scratch/ecs-express.json` contains:
   * Correct role ARNs (`ecsTaskExecutionRole` and `ecsInfrastructureRoleForExpressServices`)
   * Current DB Hostname under `DB_HOST`
   * Correct security group ID and subnet list

4. **Launch the Service:**
   ```bash
   aws ecs create-express-gateway-service \
     --cli-input-json file:///Users/hareshprajapati/dev/video-collaboration-platform/scratch/ecs-express.json \
     --region us-east-1 \
     --no-cli-pager
   ```

5. **Track Rollout and Fetch HTTPS Ingress Endpoint:**
   Check the deployment status and retrieve the generated secure `.on.aws` URL:
   ```bash
   aws ecs describe-services \
     --cluster jhoom-cluster \
     --services jhoom-express-service \
     --query "services[0].deployments[0].rolloutState" \
     --region us-east-1
   ```
   To get the HTTPS ingress URL directly:
   ```bash
   aws ecs describe-services \
     --cluster jhoom-cluster \
     --services jhoom-express-service \
     --query "services[0].activeConfigurations[0].ingressPaths[0].endpoint" \
     --output text \
     --region us-east-1
   ```

---

## Step 4: Cost Management (Cleanup / Stop)

### **To Temporarily Pause (Low Cost):**
This scales down tasks and pauses the DB to avoid compute costs, keeping the provisioned storage and ALB active for fast restarts.
```bash
# 1. Scale down Fargate tasks to 0
aws ecs update-service --cluster jhoom-cluster --service jhoom-express-service --desired-count 0 --region us-east-1

# 2. Stop the RDS Database instance
aws rds stop-db-instance --db-instance-identifier jhoom-db --region us-east-1
```

### **To Delete Everything (Absolute $0 Cost):**
This completely tears down all active services, database instances, and files to ensure zero ongoing costs.
```bash
# 1. Delete ECS Service (tears down the ALB, ingress gateway, and routing)
aws ecs delete-express-gateway-service \
  --service-arn arn:aws:ecs:us-east-1:<AWS_ACCOUNT_ID>:service/jhoom-cluster/jhoom-express-service \
  --region us-east-1

# 2. Delete ECS Cluster
aws ecs delete-cluster --cluster jhoom-cluster --region us-east-1

# 3. Delete RDS database instance
aws rds delete-db-instance \
  --db-instance-identifier jhoom-db \
  --skip-final-snapshot \
  --region us-east-1 \
  --no-cli-pager

# 4. Delete ECR Repository
aws ecr delete-repository --repository-name jhoom-app --force --region us-east-1

# 5. Delete Security Group (Run after ECS task interfaces detach)
aws ec2 delete-security-group --group-id <ECS_SECURITY_GROUP_ID> --region us-east-1
```
