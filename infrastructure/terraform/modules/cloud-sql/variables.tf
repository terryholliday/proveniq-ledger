# Proveniq Ledger - Cloud SQL Module Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "instance_name" {
  description = "Name prefix for the Cloud SQL instance"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-east1"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "network_id" {
  description = "VPC network ID for private IP"
  type        = string
}

variable "tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-custom-2-8192"
}

variable "disk_size_gb" {
  description = "Initial disk size in GB"
  type        = number
  default     = 20
}

variable "database_name" {
  description = "Name of the database to create"
  type        = string
  default     = "ledger"
}

variable "database_user" {
  description = "Name of the database user"
  type        = string
  default     = "ledger_app"
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}
