# Proveniq Ledger - Cloud SQL Module
# Phase 2: Core Infrastructure

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# -----------------------------------------------------------------------------
# RANDOM SUFFIX FOR INSTANCE NAME
# -----------------------------------------------------------------------------

resource "random_id" "db_suffix" {
  byte_length = 4
}

# -----------------------------------------------------------------------------
# CLOUD SQL INSTANCE (POSTGRESQL)
# -----------------------------------------------------------------------------

resource "google_sql_database_instance" "ledger" {
  name                = "${var.instance_name}-${random_id.db_suffix.hex}"
  database_version    = "POSTGRES_15"
  region              = var.region
  project             = var.project_id
  deletion_protection = var.environment == "prod" ? true : false

  settings {
    tier              = var.tier
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = var.disk_size_gb
    disk_autoresize   = true

    # Backup configuration
    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      point_in_time_recovery_enabled = var.environment == "prod" ? true : false
      backup_retention_settings {
        retained_backups = var.environment == "prod" ? 30 : 7
      }
    }

    # IP configuration (private only)
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.network_id
      enable_private_path_for_google_cloud_services = true
      
      # SSL enforcement
      ssl_mode = "ENCRYPTED_ONLY"
    }

    # Maintenance window
    maintenance_window {
      day          = 7 # Sunday
      hour         = 3
      update_track = "stable"
    }

    # Database flags for security and performance
    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000" # Log queries > 1 second
    }

    # Insights for query performance
    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    # Labels
    user_labels = merge(var.labels, {
      environment = var.environment
      managed-by  = "terraform"
    })
  }

  # Prevent accidental deletion
  lifecycle {
    prevent_destroy = false # Set to true for prod
  }
}

# -----------------------------------------------------------------------------
# DATABASE
# -----------------------------------------------------------------------------

resource "google_sql_database" "ledger" {
  name     = var.database_name
  instance = google_sql_database_instance.ledger.name
  project  = var.project_id
}

# -----------------------------------------------------------------------------
# DATABASE USER
# -----------------------------------------------------------------------------

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "google_sql_user" "ledger" {
  name     = var.database_user
  instance = google_sql_database_instance.ledger.name
  project  = var.project_id
  password = random_password.db_password.result
}

# -----------------------------------------------------------------------------
# STORE PASSWORD IN SECRET MANAGER
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.instance_name}-db-password"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = merge(var.labels, {
    environment = var.environment
    managed-by  = "terraform"
  })
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# -----------------------------------------------------------------------------
# OUTPUTS
# -----------------------------------------------------------------------------

output "instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.ledger.name
}

output "instance_connection_name" {
  description = "Cloud SQL connection name for Cloud SQL Proxy"
  value       = google_sql_database_instance.ledger.connection_name
}

output "private_ip_address" {
  description = "Private IP address of the instance"
  value       = google_sql_database_instance.ledger.private_ip_address
}

output "database_name" {
  description = "Database name"
  value       = google_sql_database.ledger.name
}

output "database_user" {
  description = "Database user"
  value       = google_sql_user.ledger.name
}

output "password_secret_id" {
  description = "Secret Manager secret ID for database password"
  value       = google_secret_manager_secret.db_password.secret_id
}
