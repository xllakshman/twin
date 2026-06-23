variable "project_name" {
  description = "Name prefix for all resources"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "Environment name (dev, test, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "test", "prod"], var.environment)
    error_message = "Environment must be one of: dev, test, prod."
  }
}

variable "bedrock_model_id" {
  description = "Bedrock model ID"
  type        = string
  default     = "apac.amazon.nova-micro-v1:0"
}

variable "bedrock_fallback_model_id" {
  description = "Fallback Bedrock model ID when primary hits quota throttling"
  type        = string
  default     = "apac.amazon.nova-lite-v1:0"
}

variable "llm_provider" {
  description = "LLM provider mode: bedrock, openai, bedrock_with_openai_fallback, or openai_with_bedrock_fallback"
  type        = string
  default     = "bedrock"
  validation {
    condition     = contains(["bedrock", "openai", "bedrock_with_openai_fallback", "openai_with_bedrock_fallback"], var.llm_provider)
    error_message = "llm_provider must be bedrock, openai, bedrock_with_openai_fallback, or openai_with_bedrock_fallback."
  }
}

variable "openai_model_id" {
  description = "OpenAI model ID used for OpenAI provider or Bedrock fallback"
  type        = string
  default     = "gpt-4o-mini"
}

variable "openai_api_key" {
  description = "OpenAI API key (dev fallback only; leave empty for prod)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 60
}

variable "api_throttle_burst_limit" {
  description = "API Gateway throttle burst limit"
  type        = number
  default     = 10
}

variable "api_throttle_rate_limit" {
  description = "API Gateway throttle rate limit"
  type        = number
  default     = 5
}

variable "use_custom_domain" {
  description = "Attach a custom domain to CloudFront"
  type        = bool
  default     = false
}

variable "root_domain" {
  description = "Apex domain name, e.g. mydomain.com"
  type        = string
  default     = ""
}