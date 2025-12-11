# Proveniq Ledger - Development Environment
# Phase 2: Core Infrastructure

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "proveniq-terraform-state"
    prefix = "ledger/dev"
  }
}

# -----------------------------------------------------------------------------
# LOCALS
# -----------------------------------------------------------------------------

locals {
  project_id  = var.project_id
  region      = var.region
  environment = "dev"
  
  labels = {
    project     = "proveniq-ledger"
    environment = "dev"
    team        = "platform"
    cost-center = "engineering"
    managed-by  = "terraform"
  }
}

# -----------------------------------------------------------------------------
# VPC NETWORK
# -----------------------------------------------------------------------------

resource "google_compute_network" "ledger" {
  name                    = "ledger-vpc-${local.environment}"
  project                 = local.project_id
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "ledger" {
  name          = "ledger-subnet-${local.environment}"
  project       = local.project_id
  region        = local.region
  network       = google_compute_network.ledger.id
  ip_cidr_range = "10.0.0.0/20"

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/20"
  }

  private_ip_google_access = true
}

# Private Service Connection for Cloud SQL
resource "google_compute_global_address" "private_ip_range" {
  name          = "ledger-private-ip-${local.environment}"
  project       = local.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.ledger.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.ledger.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# -----------------------------------------------------------------------------
# GKE CLUSTER
# -----------------------------------------------------------------------------

module "gke_cluster" {
  source = "../../modules/gke-cluster"

  project_id   = local.project_id
  cluster_name = "ledger-cluster-${local.environment}"
  region       = local.region
  environment  = local.environment
  
  network    = google_compute_network.ledger.name
  subnetwork = google_compute_subnetwork.ledger.name
  
  pods_range_name     = "pods"
  services_range_name = "services"
  
  authorized_networks = [
    {
      cidr_block   = "0.0.0.0/0" # Restrict in prod
      display_name = "All (dev only)"
    }
  ]
  
  labels = local.labels
}

# -----------------------------------------------------------------------------
# CLOUD SQL
# -----------------------------------------------------------------------------

module "cloud_sql" {
  source = "../../modules/cloud-sql"
  
  depends_on = [google_service_networking_connection.private_vpc_connection]

  project_id    = local.project_id
  instance_name = "ledger-db-${local.environment}"
  region        = local.region
  environment   = local.environment
  
  network_id = google_compute_network.ledger.id
  
  # Dev tier (minimal)
  tier         = "db-f1-micro"
  disk_size_gb = 10
  
  database_name = "ledger"
  database_user = "ledger_app"
  
  labels = local.labels
}

# -----------------------------------------------------------------------------
# CLOUD STORAGE (Documents)
# -----------------------------------------------------------------------------

resource "google_storage_bucket" "documents" {
  name          = "proveniq-ledger-documents-${local.environment}"
  project       = local.project_id
  location      = local.region
  force_destroy = true # Dev only

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  labels = local.labels
}

# -----------------------------------------------------------------------------
# SECRET MANAGER (API Keys, etc.)
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "ledger-jwt-secret-${local.environment}"
  project   = local.project_id

  replication {
    auto {}
  }

  labels = local.labels
}

# -----------------------------------------------------------------------------
# SERVICE ACCOUNTS
# -----------------------------------------------------------------------------

resource "google_service_account" "ledger_api" {
  account_id   = "ledger-api-${local.environment}"
  display_name = "Ledger API Service Account"
  project      = local.project_id
}

# Workload Identity binding
resource "google_service_account_iam_binding" "workload_identity" {
  service_account_id = google_service_account.ledger_api.name
  role               = "roles/iam.workloadIdentityUser"

  members = [
    "serviceAccount:${local.project_id}.svc.id.goog[default/ledger-api]"
  ]
}

# Grant necessary permissions
resource "google_project_iam_member" "ledger_api_sql" {
  project = local.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.ledger_api.email}"
}

resource "google_project_iam_member" "ledger_api_storage" {
  project = local.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.ledger_api.email}"
}

resource "google_project_iam_member" "ledger_api_secrets" {
  project = local.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.ledger_api.email}"
}

# -----------------------------------------------------------------------------
# OUTPUTS
# -----------------------------------------------------------------------------

output "gke_cluster_name" {
  value = module.gke_cluster.cluster_name
}

output "gke_cluster_endpoint" {
  value     = module.gke_cluster.cluster_endpoint
  sensitive = true
}

output "cloud_sql_connection_name" {
  value = module.cloud_sql.instance_connection_name
}

output "cloud_sql_private_ip" {
  value = module.cloud_sql.private_ip_address
}

output "documents_bucket" {
  value = google_storage_bucket.documents.name
}

output "service_account_email" {
  value = google_service_account.ledger_api.email
}
