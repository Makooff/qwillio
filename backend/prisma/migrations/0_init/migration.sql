-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "business_name" VARCHAR(500),
    "business_phone" VARCHAR(50),
    "confirmation_token" VARCHAR(255),
    "email_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "plan_type" VARCHAR(50),
    "industry" VARCHAR(100),
    "website" VARCHAR(500),
    "google_id" VARCHAR(255),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedin_outreach" (
    "id" TEXT NOT NULL,
    "prospectId" UUID,
    "linkedinUrl" TEXT NOT NULL,
    "profileName" TEXT,
    "profileTitle" TEXT,
    "companyName" TEXT,
    "niche" TEXT,
    "connectionStatus" TEXT NOT NULL DEFAULT 'pending',
    "connectionRequestAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "message1SentAt" TIMESTAMP(3),
    "message2SentAt" TIMESTAMP(3),
    "lastReplyAt" TIMESTAMP(3),
    "replyContent" TEXT,
    "interestScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linkedin_outreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospects" (
    "id" UUID NOT NULL,
    "business_name" VARCHAR(500) NOT NULL,
    "business_type" VARCHAR(100) NOT NULL,
    "sector" VARCHAR(100),
    "address" VARCHAR(500),
    "city" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "country" VARCHAR(10) NOT NULL DEFAULT 'US',
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "website" VARCHAR(500),
    "contact_name" VARCHAR(255),
    "google_place_id" VARCHAR(255),
    "google_rating" DOUBLE PRECISION,
    "google_reviews_count" INTEGER,
    "google_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(50) NOT NULL DEFAULT 'new',
    "last_call_date" TIMESTAMP(3),
    "call_duration" INTEGER,
    "call_transcript" TEXT,
    "call_sentiment" VARCHAR(50),
    "interest_level" INTEGER,
    "pain_points" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "needs_identified" TEXT,
    "notes" TEXT,
    "next_action" VARCHAR(255),
    "next_action_date" TIMESTAMP(3),
    "last_contact_date" TIMESTAMP(3),
    "assigned_to_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "call_attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "phone_number_confidence" DOUBLE PRECISION,
    "phone_validated" BOOLEAN NOT NULL DEFAULT false,
    "phone_validated_at" TIMESTAMP(3),
    "phone_validation_source" VARCHAR(50),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
    "email_bounced" BOOLEAN NOT NULL DEFAULT false,
    "email_bounced_at" TIMESTAMP(3),
    "email_confirmation_id" VARCHAR(255),
    "email_sms_followup_sent" BOOLEAN NOT NULL DEFAULT false,
    "email_sms_reply_raw" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "email_unsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "email_unsubscribed_at" TIMESTAMP(3),
    "sms_opted_out" BOOLEAN NOT NULL DEFAULT false,
    "sms_opted_out_at" TIMESTAMP(3),
    "carrier" VARCHAR(100),
    "eligible_for_call" BOOLEAN NOT NULL DEFAULT true,
    "is_mobile" BOOLEAN NOT NULL DEFAULT false,
    "line_type" VARCHAR(50),
    "next_call_at" TIMESTAMP(3),
    "niche" VARCHAR(100),
    "enriched_data" JSONB,
    "priority_score" INTEGER NOT NULL DEFAULT 0,
    "script_variant_used" VARCHAR(10),
    "state" VARCHAR(50),

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "prospect_id" UUID,
    "vapi_call_id" VARCHAR(255),
    "phone_number" VARCHAR(50) NOT NULL,
    "direction" VARCHAR(20) NOT NULL DEFAULT 'outbound',
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "status" VARCHAR(50) NOT NULL DEFAULT 'queued',
    "transcript" TEXT,
    "summary" TEXT,
    "sentiment" VARCHAR(50),
    "interest_level" INTEGER,
    "email_collected" VARCHAR(255),
    "needs_mentioned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budget_mentioned" VARCHAR(100),
    "timeline_mentioned" VARCHAR(100),
    "decision_maker_reached" BOOLEAN NOT NULL DEFAULT false,
    "outcome" VARCHAR(100),
    "recommended_package" VARCHAR(50),
    "next_action" VARCHAR(255),
    "recording_url" VARCHAR(500),
    "cost" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "setup_fee_objection_raised" BOOLEAN NOT NULL DEFAULT false,
    "quality_score" INTEGER,
    "script_drop_off_point" VARCHAR(50),
    "claude_summary" TEXT,
    "detection_result" VARCHAR(50),
    "interest_score" INTEGER,
    "language" VARCHAR(10),
    "lead_captured" BOOLEAN NOT NULL DEFAULT false,
    "niche" VARCHAR(100),
    "script_variant" VARCHAR(10),
    "transfer_requested" BOOLEAN NOT NULL DEFAULT false,
    "twilio_number_used" VARCHAR(50),
    "agent_confidence_score" INTEGER,
    "call_quality_score" INTEGER,
    "drop_off_reason" TEXT,
    "filler_words_used" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "key_objection" TEXT,
    "missed_opportunity" TEXT,
    "prospect_pain_level" INTEGER,
    "prospect_sentiment" VARCHAR(50),
    "recommended_micro_fix" TEXT,
    "sentiment_shift" VARCHAR(20),
    "sentiment_timeline" JSONB,
    "what_failed" TEXT,
    "what_worked" TEXT,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "prospect_id" UUID,
    "package_type" VARCHAR(50) NOT NULL,
    "setup_fee" DECIMAL(10,2) NOT NULL,
    "monthly_fee" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "features_included" JSONB NOT NULL,
    "valid_until" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'sent',
    "sent_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "stripe_payment_link" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "installment_months" INTEGER NOT NULL DEFAULT 1,
    "setup_fee_installment" BOOLEAN NOT NULL DEFAULT false,
    "contract_pdf_url" VARCHAR(500),
    "contract_signed_at" TIMESTAMP(3),
    "docusign_envelope_id" VARCHAR(100),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "prospect_id" UUID,
    "quote_id" UUID,
    "business_name" VARCHAR(500) NOT NULL,
    "business_type" VARCHAR(100) NOT NULL,
    "sector" VARCHAR(100),
    "contact_name" VARCHAR(255) NOT NULL,
    "contact_email" VARCHAR(255) NOT NULL,
    "contact_phone" VARCHAR(50),
    "address" VARCHAR(500),
    "city" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "country" VARCHAR(10) NOT NULL DEFAULT 'BE',
    "plan_type" VARCHAR(50) NOT NULL,
    "setup_fee" DECIMAL(10,2) NOT NULL,
    "monthly_fee" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'EUR',
    "stripe_customer_id" VARCHAR(255),
    "stripe_subscription_id" VARCHAR(255),
    "subscription_status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "vapi_assistant_id" VARCHAR(255),
    "vapi_phone_number" VARCHAR(50),
    "vapi_config" JSONB,
    "onboarding_status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "onboarding_completed_at" TIMESTAMP(3),
    "activation_date" TIMESTAMP(3),
    "cancellation_date" TIMESTAMP(3),
    "total_calls_made" INTEGER NOT NULL DEFAULT 0,
    "monthly_calls_quota" INTEGER,
    "last_call_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_trial" BOOLEAN NOT NULL DEFAULT false,
    "trial_converted_at" TIMESTAMP(3),
    "trial_end_date" TIMESTAMP(3),
    "trial_start_date" TIMESTAMP(3),
    "add_ons" JSONB,
    "contract_signed_at" TIMESTAMP(3),
    "contract_url" VARCHAR(500),
    "dashboard_token" VARCHAR(255),
    "loom_video_url" VARCHAR(500),
    "onboarding_data" JSONB,
    "onboarding_form_done_at" TIMESTAMP(3),
    "onboarding_form_sent_at" TIMESTAMP(3),
    "transfer_number" VARCHAR(50),
    "user_id" UUID,
    "google_calendar_id" VARCHAR(255),
    "google_calendar_refresh_token" TEXT,
    "agent_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "agent_name" VARCHAR(100),
    "forwarding_status" VARCHAR(50),
    "forwarding_type" VARCHAR(50),
    "forwarding_verified_at" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'email',
    "target_business_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "target_cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "target_min_score" INTEGER,
    "target_max_score" INTEGER,
    "target_statuses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject_line" VARCHAR(255),
    "message_template" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3),
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "opened_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_count" INTEGER NOT NULL DEFAULT 0,
    "replied_count" INTEGER NOT NULL DEFAULT 0,
    "bounced_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_sends" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "prospect_id" UUID NOT NULL,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "replied_at" TIMESTAMP(3),
    "bounced_at" TIMESTAMP(3),
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "message_id" VARCHAR(255),

    CONSTRAINT "campaign_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" UUID NOT NULL,
    "reminder_type" VARCHAR(50) NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "result" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "client_id" UUID,
    "stripe_payment_intent_id" VARCHAR(255),
    "stripe_invoice_id" VARCHAR(255),
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'EUR',
    "payment_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "description" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" UUID NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "status" VARCHAR(50) NOT NULL DEFAULT 'received',
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" UUID NOT NULL,
    "to" VARCHAR(50) NOT NULL,
    "body" TEXT NOT NULL,
    "message_type" VARCHAR(50) NOT NULL,
    "twilio_sid" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'sent',
    "error_msg" TEXT,
    "prospect_id" UUID,
    "client_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "prospects_added" INTEGER NOT NULL DEFAULT 0,
    "prospects_contacted" INTEGER NOT NULL DEFAULT 0,
    "prospects_qualified" INTEGER NOT NULL DEFAULT 0,
    "calls_made" INTEGER NOT NULL DEFAULT 0,
    "calls_successful" INTEGER NOT NULL DEFAULT 0,
    "calls_failed" INTEGER NOT NULL DEFAULT 0,
    "total_call_duration" INTEGER NOT NULL DEFAULT 0,
    "quotes_sent" INTEGER NOT NULL DEFAULT 0,
    "quotes_accepted" INTEGER NOT NULL DEFAULT 0,
    "new_clients" INTEGER NOT NULL DEFAULT 0,
    "revenue_setup_fees" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "revenue_subscriptions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cost_vapi_calls" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "cost_apis" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cost_twilio_lookup" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "cost_twilio_sms" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "phones_validated" INTEGER NOT NULL DEFAULT 0,
    "sms_delivered" INTEGER NOT NULL DEFAULT 0,
    "sms_failed" INTEGER NOT NULL DEFAULT 0,
    "sms_sent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_status" (
    "id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "calls_today" INTEGER NOT NULL DEFAULT 0,
    "calls_quota_daily" INTEGER NOT NULL DEFAULT 50,
    "last_prospection" TIMESTAMP(3),
    "last_call" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_calls" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "vapi_call_id" VARCHAR(255),
    "caller_number" VARCHAR(50),
    "caller_name" VARCHAR(255),
    "direction" VARCHAR(20) NOT NULL DEFAULT 'inbound',
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "status" VARCHAR(50) NOT NULL DEFAULT 'in-progress',
    "transcript" TEXT,
    "summary" TEXT,
    "sentiment" VARCHAR(50),
    "outcome" VARCHAR(100),
    "recording_url" VARCHAR(500),
    "email_collected" VARCHAR(255),
    "name_collected" VARCHAR(255),
    "phone_collected" VARCHAR(50),
    "booking_requested" BOOLEAN NOT NULL DEFAULT false,
    "booking_date" TIMESTAMP(3),
    "booking_details" TEXT,
    "is_lead" BOOLEAN NOT NULL DEFAULT false,
    "lead_score" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_bookings" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "client_call_id" UUID,
    "customer_name" VARCHAR(255) NOT NULL,
    "customer_phone" VARCHAR(50),
    "customer_email" VARCHAR(255),
    "booking_date" TIMESTAMP(3) NOT NULL,
    "booking_time" VARCHAR(20),
    "service_type" VARCHAR(255),
    "party_size" INTEGER,
    "special_requests" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'confirmed',
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "reminder_sent_at" TIMESTAMP(3),
    "google_event_id" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sms_confirmation_sent" BOOLEAN NOT NULL DEFAULT false,
    "sms_reminder_sent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "client_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_analytics_daily" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_calls" INTEGER NOT NULL DEFAULT 0,
    "answered_calls" INTEGER NOT NULL DEFAULT 0,
    "missed_calls" INTEGER NOT NULL DEFAULT 0,
    "total_duration" INTEGER NOT NULL DEFAULT 0,
    "avg_duration" INTEGER NOT NULL DEFAULT 0,
    "leads_generated" INTEGER NOT NULL DEFAULT 0,
    "bookings_made" INTEGER NOT NULL DEFAULT 0,
    "emails_collected" INTEGER NOT NULL DEFAULT 0,
    "sentiment_positive" INTEGER NOT NULL DEFAULT 0,
    "sentiment_neutral" INTEGER NOT NULL DEFAULT 0,
    "sentiment_negative" INTEGER NOT NULL DEFAULT 0,
    "top_issues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_transfers" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "client_call_id" UUID,
    "vapi_call_id" VARCHAR(255),
    "transfer_number" VARCHAR(50) NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "trigger_phrase" VARCHAR(500),
    "pre_transfer_message" TEXT,
    "transfer_status" VARCHAR(50) NOT NULL DEFAULT 'initiated',
    "failed_reason" TEXT,
    "callback_requested" BOOLEAN NOT NULL DEFAULT false,
    "callback_number" VARCHAR(50),
    "callback_priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "callback_completed_at" TIMESTAMP(3),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "niche_insights" (
    "id" UUID NOT NULL,
    "niche" VARCHAR(100) NOT NULL,
    "insight_type" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "sample_size" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source" VARCHAR(50) NOT NULL DEFAULT 'post_call',
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "niche_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_fingerprints" (
    "id" UUID NOT NULL,
    "account_id" UUID,
    "email_hash" VARCHAR(128),
    "phone_hash" VARCHAR(128),
    "device_fingerprint_hash" VARCHAR(128),
    "ip_hash" VARCHAR(128),
    "card_fingerprint" VARCHAR(255),
    "ip_country" VARCHAR(10),
    "phone_country" VARCHAR(10),
    "vpn_detected" BOOLEAN NOT NULL DEFAULT false,
    "suspicious_signals" INTEGER NOT NULL DEFAULT 0,
    "used_trial" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "block_reason" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_fingerprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_deletions" (
    "id" UUID NOT NULL,
    "original_account_id" UUID NOT NULL,
    "email_hash" VARCHAR(128) NOT NULL,
    "phone_hash" VARCHAR(128),
    "device_fingerprint_hash" VARCHAR(128),
    "ip_hash" VARCHAR(128),
    "card_fingerprint" VARCHAR(255),
    "had_active_trial" BOOLEAN NOT NULL DEFAULT false,
    "had_paid_subscription" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cooldown_until" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_deletions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_acceptances" (
    "id" UUID NOT NULL,
    "client_id" UUID,
    "user_id" UUID,
    "contract_version" VARCHAR(20) NOT NULL,
    "plan_type" VARCHAR(50) NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" TEXT NOT NULL,
    "contract_pdf_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "address" VARCHAR(500),
    "niche" VARCHAR(100),
    "lead_score" INTEGER,
    "status" VARCHAR(50) NOT NULL DEFAULT 'new',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "external_ids" JSONB,
    "enriched_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "stage" VARCHAR(50) NOT NULL DEFAULT 'new',
    "value" DECIMAL(10,2),
    "probability" INTEGER,
    "close_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "call_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_integrations" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "config" JSONB,
    "last_sync" TIMESTAMP(3),
    "sync_status" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "direction" VARCHAR(20) NOT NULL,
    "entity" VARCHAR(50) NOT NULL,
    "external_id" VARCHAR(255),
    "status" VARCHAR(50) NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "contact_id" UUID,
    "provider" VARCHAR(50) NOT NULL,
    "qwillio_version" JSONB NOT NULL,
    "external_version" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolution" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_subscriptions" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "email_ai" BOOLEAN NOT NULL DEFAULT false,
    "payments_ai" BOOLEAN NOT NULL DEFAULT false,
    "accounting_ai" BOOLEAN NOT NULL DEFAULT false,
    "inventory_ai" BOOLEAN NOT NULL DEFAULT false,
    "marketing_ai" BOOLEAN NOT NULL DEFAULT false,
    "reputation_ai" BOOLEAN NOT NULL DEFAULT false,
    "scheduling_ai" BOOLEAN NOT NULL DEFAULT false,
    "support_ai" BOOLEAN NOT NULL DEFAULT false,
    "crm_ai" BOOLEAN NOT NULL DEFAULT false,
    "document_ai" BOOLEAN NOT NULL DEFAULT false,
    "local_seo_ai" BOOLEAN NOT NULL DEFAULT false,
    "lead_gen_ai" BOOLEAN NOT NULL DEFAULT false,
    "analytics_ai" BOOLEAN NOT NULL DEFAULT false,
    "bundle" BOOLEAN NOT NULL DEFAULT false,
    "stripe_subscription_id" VARCHAR(255),
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_marketing_configs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "channels" JSONB,
    "tone" VARCHAR(50) NOT NULL DEFAULT 'professional',
    "post_frequency" VARCHAR(50) NOT NULL DEFAULT 'weekly',
    "brand_kit" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_marketing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_marketing_activities" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "channel" VARCHAR(50),
    "content" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "scheduled_for" TIMESTAMP(3),
    "performed_at" TIMESTAMP(3),
    "metrics" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_marketing_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_reputation_configs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "platforms" JSONB,
    "auto_reply_enabled" BOOLEAN NOT NULL DEFAULT false,
    "escalation_threshold" INTEGER NOT NULL DEFAULT 3,
    "reply_tone" VARCHAR(50) NOT NULL DEFAULT 'professional',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_reputation_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_reputation_activities" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "platform" VARCHAR(50),
    "rating" INTEGER,
    "review_id" VARCHAR(255),
    "content" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "performed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_reputation_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_scheduling_configs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "working_hours" JSONB,
    "reminder_timing" JSONB,
    "no_show_policy" VARCHAR(50) NOT NULL DEFAULT 'sms_reminder',
    "slot_duration_min" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_scheduling_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_scheduling_activities" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "booking_id" VARCHAR(255),
    "content" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "performed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_scheduling_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_support_configs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "channels" JSONB,
    "auto_reply_enabled" BOOLEAN NOT NULL DEFAULT false,
    "escalation_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "escalation_email" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_support_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_support_activities" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "channel" VARCHAR(50),
    "ticket_id" VARCHAR(255),
    "content" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "performed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_support_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_crm_configs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "provider" VARCHAR(50) NOT NULL DEFAULT 'hubspot',
    "access_token" JSONB,
    "pipeline_mapping" JSONB,
    "auto_sync_enabled" BOOLEAN NOT NULL DEFAULT false,
    "relance_enabled" BOOLEAN NOT NULL DEFAULT true,
    "forecast_horizon_mo" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_crm_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_crm_activities" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(50),
    "deal_id" VARCHAR(255),
    "contact_id" VARCHAR(255),
    "content" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "performed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_document_configs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "templates" JSONB,
    "signature_provider" VARCHAR(50),
    "brand_header" JSONB,
    "default_currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "legal_disclaimer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_document_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_document_activities" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "document_id" VARCHAR(255),
    "document_type" VARCHAR(50) NOT NULL,
    "recipient_email" VARCHAR(255),
    "content" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "signed_at" TIMESTAMP(3),
    "performed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_document_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_local_seo_configs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "google_business_id" VARCHAR(255),
    "target_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "service_area" JSONB,
    "platforms" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_local_seo_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_local_seo_activities" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "platform" VARCHAR(50),
    "keyword" VARCHAR(255),
    "position" INTEGER,
    "content" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "performed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_local_seo_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_lead_gen_configs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "target_niches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "target_cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channels" JSONB,
    "daily_quota" INTEGER NOT NULL DEFAULT 20,
    "sequence_templates" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_lead_gen_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_lead_gen_activities" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "prospect_id" UUID,
    "channel" VARCHAR(50),
    "step" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "performed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_lead_gen_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_analytics_configs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "digest_frequency" VARCHAR(20) NOT NULL DEFAULT 'weekly',
    "digest_day" INTEGER NOT NULL DEFAULT 1,
    "alert_channels" JSONB,
    "anomaly_thresholds" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_analytics_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_analytics_activities" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "metric" VARCHAR(100),
    "value" DOUBLE PRECISION,
    "period" VARCHAR(50),
    "content" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "performed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_analytics_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_prompt_configs" (
    "id" UUID NOT NULL,
    "agent_type" VARCHAR(50) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "user_prompt_template" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" VARCHAR(255),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_prompt_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_email_configs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "gmail_token" JSONB,
    "outlook_token" JSONB,
    "auto_reply" BOOLEAN NOT NULL DEFAULT false,
    "reply_tone" VARCHAR(50) NOT NULL DEFAULT 'professional',
    "blocked_senders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "templates" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "business_context" TEXT,
    "follow_up_delay_hours" INTEGER NOT NULL DEFAULT 24,
    "follow_up_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_at" TIMESTAMP(3),

    CONSTRAINT "agent_email_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_inventory" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "product_name" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" VARCHAR(50),
    "min_threshold" DECIMAL(10,2),
    "supplier_email" VARCHAR(255),
    "auto_order" BOOLEAN NOT NULL DEFAULT false,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avg_daily_usage" DECIMAL(10,2),
    "days_until_empty" INTEGER,
    "last_ordered_at" TIMESTAMP(3),

    CONSTRAINT "agent_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_accounting" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "quickbooks_token" JSONB,
    "wave_token" JSONB,
    "stripe_connected" BOOLEAN NOT NULL DEFAULT false,
    "auto_invoice" BOOLEAN NOT NULL DEFAULT false,
    "invoice_template" JSONB,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_accounting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_expenses" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "category" VARCHAR(50),
    "category_confidence" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL,
    "vendor" VARCHAR(255),
    "receipt_url" VARCHAR(500),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_income" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "source" VARCHAR(255),
    "invoice_id" VARCHAR(255),
    "date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_financial_reports" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "report_type" VARCHAR(50) NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "total_income" DECIMAL(12,2) NOT NULL,
    "total_expenses" DECIMAL(12,2) NOT NULL,
    "net_profit" DECIMAL(12,2) NOT NULL,
    "category_summary" JSONB NOT NULL,
    "ai_insights" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_financial_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_invoices" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "customer_name" VARCHAR(255) NOT NULL,
    "customer_email" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "due_date" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_at" TIMESTAMP(3),
    "line_items" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_inventory_logs" (
    "id" UUID NOT NULL,
    "inventory_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "change_type" VARCHAR(50) NOT NULL,
    "quantity_change" DECIMAL(10,2) NOT NULL,
    "quantity_after" DECIMAL(10,2) NOT NULL,
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_reorder_requests" (
    "id" UUID NOT NULL,
    "inventory_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "supplier_email" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "email_body" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'sent',
    "sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_reorder_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_emails" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "gmail_message_id" VARCHAR(255) NOT NULL,
    "thread_id" VARCHAR(255),
    "from_address" VARCHAR(500) NOT NULL,
    "to_address" VARCHAR(500) NOT NULL,
    "subject" VARCHAR(1000) NOT NULL,
    "body_preview" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "classification" VARCHAR(50),
    "classification_confidence" DOUBLE PRECISION,
    "auto_replied" BOOLEAN NOT NULL DEFAULT false,
    "auto_reply_text" TEXT,
    "needs_follow_up" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_at" TIMESTAMP(3),
    "follow_up_sent" BOOLEAN NOT NULL DEFAULT false,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_mutations" (
    "id" UUID NOT NULL,
    "niche" VARCHAR(100) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "change_applied" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calls_before" INTEGER NOT NULL,
    "conversion_before" DOUBLE PRECISION NOT NULL,
    "calls_after" INTEGER NOT NULL DEFAULT 0,
    "conversion_after" DOUBLE PRECISION,
    "status" VARCHAR(50) NOT NULL DEFAULT 'testing',
    "confidence_score" INTEGER,
    "reverted_at" TIMESTAMP(3),
    "revert_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calls_variant_a" INTEGER NOT NULL DEFAULT 0,
    "calls_variant_b" INTEGER NOT NULL DEFAULT 0,
    "conversion_variant_a" DOUBLE PRECISION,
    "conversion_variant_b" DOUBLE PRECISION,
    "revert_forensics" TEXT,
    "statistical_significance" DOUBLE PRECISION,

    CONSTRAINT "script_mutations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_decisions" (
    "id" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" VARCHAR(50) NOT NULL,
    "niche" VARCHAR(100),
    "language" VARCHAR(10),
    "confidence_score" INTEGER,
    "data_points_used" INTEGER,
    "outcome" VARCHAR(50) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_ab_tests" (
    "id" UUID NOT NULL,
    "niche" VARCHAR(100) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "variant_a" TEXT NOT NULL,
    "variant_b" TEXT NOT NULL,
    "calls_a" INTEGER NOT NULL DEFAULT 0,
    "conversions_a" INTEGER NOT NULL DEFAULT 0,
    "calls_b" INTEGER NOT NULL DEFAULT 0,
    "conversions_b" INTEGER NOT NULL DEFAULT 0,
    "winner" VARCHAR(10),
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "script_ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objection_handlers" (
    "id" UUID NOT NULL,
    "niche" VARCHAR(100) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "objection_text" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 0,
    "handler_v1" TEXT,
    "handler_v2" TEXT,
    "win_rate_v1" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "win_rate_v2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active_handler" VARCHAR(10) NOT NULL DEFAULT 'v1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objection_handlers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_versions" (
    "id" UUID NOT NULL,
    "niche" VARCHAR(100) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "version" INTEGER NOT NULL,
    "script_text" TEXT NOT NULL,
    "opening_text" TEXT,
    "conversion_rate" DOUBLE PRECISION,
    "calls_on_version" INTEGER NOT NULL DEFAULT 0,
    "avg_interest_score" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retired_at" TIMESTAMP(3),

    CONSTRAINT "script_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_variants" (
    "id" UUID NOT NULL,
    "niche" VARCHAR(100) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "opening_text" TEXT NOT NULL,
    "calls_count" INTEGER NOT NULL DEFAULT 0,
    "connection_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "engagement_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "drop_off_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "promoted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opening_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "niche_best_times" (
    "id" UUID NOT NULL,
    "niche" VARCHAR(100) NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "hour_utc" INTEGER NOT NULL,
    "conversion_rate" DOUBLE PRECISION NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "niche_best_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_presence_numbers" (
    "id" UUID NOT NULL,
    "area_code" VARCHAR(10) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "twilio_sid" VARCHAR(100),
    "city" VARCHAR(100),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "local_presence_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_sequences" (
    "id" UUID NOT NULL,
    "prospect_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "step" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_config" (
    "id" UUID NOT NULL,
    "calls_per_day" INTEGER NOT NULL DEFAULT 50,
    "call_window_start" INTEGER NOT NULL DEFAULT 9,
    "call_window_end" INTEGER NOT NULL DEFAULT 19,
    "active_days" TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday']::TEXT[],
    "call_interval_minutes" INTEGER NOT NULL DEFAULT 20,
    "prospection_quota_per_day" INTEGER NOT NULL DEFAULT 100,
    "min_priority_score" INTEGER NOT NULL DEFAULT 0,
    "target_cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "vapi_assistant_id" VARCHAR(255),
    "vapi_voice_id" VARCHAR(100),
    "max_call_duration_min" INTEGER NOT NULL DEFAULT 10,
    "silence_timeout_seconds" INTEGER NOT NULL DEFAULT 30,
    "apify_actor_id" VARCHAR(255),
    "target_niches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "apify_target_cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_booking_slots" (
    "id" UUID NOT NULL,
    "prospect_id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "slots" JSONB NOT NULL,
    "selected_slot" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "confirmed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_booking_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_anomalies" (
    "id" UUID NOT NULL,
    "metric_name" VARCHAR(100) NOT NULL,
    "current_value" DOUBLE PRECISION NOT NULL,
    "avg_value" DOUBLE PRECISION NOT NULL,
    "deviation" DOUBLE PRECISION NOT NULL,
    "diagnosis" TEXT,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'warn',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_strategies" (
    "id" UUID NOT NULL,
    "agent_type" VARCHAR(50) NOT NULL,
    "niche" VARCHAR(100) NOT NULL,
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "playbook" JSONB NOT NULL,
    "win_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sample_size" INTEGER NOT NULL DEFAULT 0,
    "evolved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" UUID NOT NULL,
    "agent_type" VARCHAR(50) NOT NULL,
    "prospect_id" UUID,
    "niche" VARCHAR(100),
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "strategy_id" UUID,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "outcome" VARCHAR(50),
    "reward" DOUBLE PRECISION,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_insights" (
    "id" UUID NOT NULL,
    "source_agent" VARCHAR(50) NOT NULL,
    "target_agents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "niche" VARCHAR(100),
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "insight_type" VARCHAR(50) NOT NULL,
    "pattern" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sample_size" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "applied_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "primary_color" TEXT DEFAULT '#7B5CF0',
    "owner_id" UUID NOT NULL,
    "commission_pct" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_clients" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY['read']::TEXT[],
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_confirmation_token_key" ON "users"("confirmation_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "linkedin_outreach_linkedinUrl_key" ON "linkedin_outreach"("linkedinUrl");

-- CreateIndex
CREATE INDEX "linkedin_outreach_connectionStatus_idx" ON "linkedin_outreach"("connectionStatus");

-- CreateIndex
CREATE INDEX "linkedin_outreach_niche_idx" ON "linkedin_outreach"("niche");

-- CreateIndex
CREATE UNIQUE INDEX "prospects_google_place_id_key" ON "prospects"("google_place_id");

-- CreateIndex
CREATE INDEX "prospects_status_idx" ON "prospects"("status");

-- CreateIndex
CREATE INDEX "prospects_business_type_idx" ON "prospects"("business_type");

-- CreateIndex
CREATE INDEX "prospects_city_idx" ON "prospects"("city");

-- CreateIndex
CREATE INDEX "prospects_score_idx" ON "prospects"("score");

-- CreateIndex
CREATE INDEX "prospects_priority_score_idx" ON "prospects"("priority_score");

-- CreateIndex
CREATE INDEX "prospects_niche_idx" ON "prospects"("niche");

-- CreateIndex
CREATE INDEX "prospects_eligible_for_call_idx" ON "prospects"("eligible_for_call");

-- CreateIndex
CREATE UNIQUE INDEX "calls_vapi_call_id_key" ON "calls"("vapi_call_id");

-- CreateIndex
CREATE INDEX "calls_prospect_id_idx" ON "calls"("prospect_id");

-- CreateIndex
CREATE INDEX "calls_status_idx" ON "calls"("status");

-- CreateIndex
CREATE INDEX "calls_niche_idx" ON "calls"("niche");

-- CreateIndex
CREATE INDEX "calls_detection_result_idx" ON "calls"("detection_result");

-- CreateIndex
CREATE INDEX "quotes_prospect_id_idx" ON "quotes"("prospect_id");

-- CreateIndex
CREATE INDEX "quotes_status_idx" ON "quotes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "clients_stripe_customer_id_key" ON "clients"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_stripe_subscription_id_key" ON "clients"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_dashboard_token_key" ON "clients"("dashboard_token");

-- CreateIndex
CREATE UNIQUE INDEX "clients_user_id_key" ON "clients"("user_id");

-- CreateIndex
CREATE INDEX "clients_subscription_status_idx" ON "clients"("subscription_status");

-- CreateIndex
CREATE INDEX "clients_plan_type_idx" ON "clients"("plan_type");

-- CreateIndex
CREATE INDEX "clients_onboarding_status_idx" ON "clients"("onboarding_status");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaign_sends_campaign_id_idx" ON "campaign_sends"("campaign_id");

-- CreateIndex
CREATE INDEX "campaign_sends_prospect_id_idx" ON "campaign_sends"("prospect_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_sends_campaign_id_prospect_id_key" ON "campaign_sends"("campaign_id", "prospect_id");

-- CreateIndex
CREATE INDEX "reminders_status_idx" ON "reminders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_key" ON "payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "payments_client_id_idx" ON "payments"("client_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "webhook_logs_source_idx" ON "webhook_logs"("source");

-- CreateIndex
CREATE INDEX "webhook_logs_status_idx" ON "webhook_logs"("status");

-- CreateIndex
CREATE INDEX "sms_logs_to_idx" ON "sms_logs"("to");

-- CreateIndex
CREATE INDEX "sms_logs_message_type_idx" ON "sms_logs"("message_type");

-- CreateIndex
CREATE INDEX "sms_logs_created_at_idx" ON "sms_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_date_key" ON "analytics_daily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "client_calls_vapi_call_id_key" ON "client_calls"("vapi_call_id");

-- CreateIndex
CREATE INDEX "client_calls_client_id_idx" ON "client_calls"("client_id");

-- CreateIndex
CREATE INDEX "client_calls_status_idx" ON "client_calls"("status");

-- CreateIndex
CREATE INDEX "client_calls_created_at_idx" ON "client_calls"("created_at");

-- CreateIndex
CREATE INDEX "client_calls_client_id_created_at_idx" ON "client_calls"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "client_bookings_client_id_idx" ON "client_bookings"("client_id");

-- CreateIndex
CREATE INDEX "client_bookings_booking_date_idx" ON "client_bookings"("booking_date");

-- CreateIndex
CREATE INDEX "client_bookings_status_idx" ON "client_bookings"("status");

-- CreateIndex
CREATE INDEX "client_bookings_client_id_created_at_idx" ON "client_bookings"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "client_analytics_daily_client_id_idx" ON "client_analytics_daily"("client_id");

-- CreateIndex
CREATE INDEX "client_analytics_daily_date_idx" ON "client_analytics_daily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "client_analytics_daily_client_id_date_key" ON "client_analytics_daily"("client_id", "date");

-- CreateIndex
CREATE INDEX "call_transfers_client_id_idx" ON "call_transfers"("client_id");

-- CreateIndex
CREATE INDEX "call_transfers_transfer_status_idx" ON "call_transfers"("transfer_status");

-- CreateIndex
CREATE INDEX "call_transfers_created_at_idx" ON "call_transfers"("created_at");

-- CreateIndex
CREATE INDEX "niche_insights_niche_idx" ON "niche_insights"("niche");

-- CreateIndex
CREATE INDEX "niche_insights_is_active_idx" ON "niche_insights"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "niche_insights_niche_insight_type_content_key" ON "niche_insights"("niche", "insight_type", "content");

-- CreateIndex
CREATE INDEX "trial_fingerprints_email_hash_idx" ON "trial_fingerprints"("email_hash");

-- CreateIndex
CREATE INDEX "trial_fingerprints_phone_hash_idx" ON "trial_fingerprints"("phone_hash");

-- CreateIndex
CREATE INDEX "trial_fingerprints_device_fingerprint_hash_idx" ON "trial_fingerprints"("device_fingerprint_hash");

-- CreateIndex
CREATE INDEX "trial_fingerprints_ip_hash_idx" ON "trial_fingerprints"("ip_hash");

-- CreateIndex
CREATE INDEX "trial_fingerprints_card_fingerprint_idx" ON "trial_fingerprints"("card_fingerprint");

-- CreateIndex
CREATE INDEX "account_deletions_email_hash_idx" ON "account_deletions"("email_hash");

-- CreateIndex
CREATE INDEX "account_deletions_phone_hash_idx" ON "account_deletions"("phone_hash");

-- CreateIndex
CREATE INDEX "account_deletions_card_fingerprint_idx" ON "account_deletions"("card_fingerprint");

-- CreateIndex
CREATE INDEX "contract_acceptances_client_id_idx" ON "contract_acceptances"("client_id");

-- CreateIndex
CREATE INDEX "contract_acceptances_user_id_idx" ON "contract_acceptances"("user_id");

-- CreateIndex
CREATE INDEX "contacts_client_id_idx" ON "contacts"("client_id");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_phone_idx" ON "contacts"("phone");

-- CreateIndex
CREATE INDEX "contacts_status_idx" ON "contacts"("status");

-- CreateIndex
CREATE INDEX "deals_client_id_idx" ON "deals"("client_id");

-- CreateIndex
CREATE INDEX "deals_stage_idx" ON "deals"("stage");

-- CreateIndex
CREATE INDEX "activities_client_id_idx" ON "activities"("client_id");

-- CreateIndex
CREATE INDEX "activities_contact_id_idx" ON "activities"("contact_id");

-- CreateIndex
CREATE INDEX "crm_integrations_client_id_idx" ON "crm_integrations"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_integrations_client_id_provider_key" ON "crm_integrations"("client_id", "provider");

-- CreateIndex
CREATE INDEX "sync_logs_client_id_idx" ON "sync_logs"("client_id");

-- CreateIndex
CREATE INDEX "sync_conflicts_client_id_idx" ON "sync_conflicts"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_subscriptions_client_id_key" ON "agent_subscriptions"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_marketing_configs_client_id_key" ON "agent_marketing_configs"("client_id");

-- CreateIndex
CREATE INDEX "agent_marketing_activities_client_id_created_at_idx" ON "agent_marketing_activities"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_marketing_activities_client_id_status_idx" ON "agent_marketing_activities"("client_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_reputation_configs_client_id_key" ON "agent_reputation_configs"("client_id");

-- CreateIndex
CREATE INDEX "agent_reputation_activities_client_id_created_at_idx" ON "agent_reputation_activities"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_reputation_activities_client_id_status_idx" ON "agent_reputation_activities"("client_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_scheduling_configs_client_id_key" ON "agent_scheduling_configs"("client_id");

-- CreateIndex
CREATE INDEX "agent_scheduling_activities_client_id_created_at_idx" ON "agent_scheduling_activities"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_scheduling_activities_client_id_status_idx" ON "agent_scheduling_activities"("client_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_support_configs_client_id_key" ON "agent_support_configs"("client_id");

-- CreateIndex
CREATE INDEX "agent_support_activities_client_id_created_at_idx" ON "agent_support_activities"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_support_activities_client_id_status_idx" ON "agent_support_activities"("client_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_crm_configs_client_id_key" ON "agent_crm_configs"("client_id");

-- CreateIndex
CREATE INDEX "agent_crm_activities_client_id_created_at_idx" ON "agent_crm_activities"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_crm_activities_client_id_status_idx" ON "agent_crm_activities"("client_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_document_configs_client_id_key" ON "agent_document_configs"("client_id");

-- CreateIndex
CREATE INDEX "agent_document_activities_client_id_created_at_idx" ON "agent_document_activities"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_document_activities_client_id_status_idx" ON "agent_document_activities"("client_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_local_seo_configs_client_id_key" ON "agent_local_seo_configs"("client_id");

-- CreateIndex
CREATE INDEX "agent_local_seo_activities_client_id_created_at_idx" ON "agent_local_seo_activities"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_local_seo_activities_client_id_status_idx" ON "agent_local_seo_activities"("client_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_lead_gen_configs_client_id_key" ON "agent_lead_gen_configs"("client_id");

-- CreateIndex
CREATE INDEX "agent_lead_gen_activities_client_id_created_at_idx" ON "agent_lead_gen_activities"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_lead_gen_activities_client_id_status_idx" ON "agent_lead_gen_activities"("client_id", "status");

-- CreateIndex
CREATE INDEX "agent_lead_gen_activities_client_id_prospect_id_idx" ON "agent_lead_gen_activities"("client_id", "prospect_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_analytics_configs_client_id_key" ON "agent_analytics_configs"("client_id");

-- CreateIndex
CREATE INDEX "agent_analytics_activities_client_id_created_at_idx" ON "agent_analytics_activities"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_analytics_activities_client_id_status_idx" ON "agent_analytics_activities"("client_id", "status");

-- CreateIndex
CREATE INDEX "agent_prompt_configs_agent_type_language_active_idx" ON "agent_prompt_configs"("agent_type", "language", "active");

-- CreateIndex
CREATE UNIQUE INDEX "agent_prompt_configs_agent_type_language_version_key" ON "agent_prompt_configs"("agent_type", "language", "version");

-- CreateIndex
CREATE UNIQUE INDEX "agent_email_configs_client_id_key" ON "agent_email_configs"("client_id");

-- CreateIndex
CREATE INDEX "agent_inventory_client_id_idx" ON "agent_inventory"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_accounting_client_id_key" ON "agent_accounting"("client_id");

-- CreateIndex
CREATE INDEX "agent_expenses_client_id_idx" ON "agent_expenses"("client_id");

-- CreateIndex
CREATE INDEX "agent_expenses_client_id_date_idx" ON "agent_expenses"("client_id", "date");

-- CreateIndex
CREATE INDEX "agent_expenses_client_id_category_idx" ON "agent_expenses"("client_id", "category");

-- CreateIndex
CREATE INDEX "agent_income_client_id_idx" ON "agent_income"("client_id");

-- CreateIndex
CREATE INDEX "agent_income_client_id_date_idx" ON "agent_income"("client_id", "date");

-- CreateIndex
CREATE INDEX "agent_financial_reports_client_id_idx" ON "agent_financial_reports"("client_id");

-- CreateIndex
CREATE INDEX "agent_financial_reports_client_id_report_type_idx" ON "agent_financial_reports"("client_id", "report_type");

-- CreateIndex
CREATE UNIQUE INDEX "agent_invoices_invoice_number_key" ON "agent_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "agent_invoices_client_id_idx" ON "agent_invoices"("client_id");

-- CreateIndex
CREATE INDEX "agent_invoices_status_idx" ON "agent_invoices"("status");

-- CreateIndex
CREATE INDEX "agent_invoices_due_date_idx" ON "agent_invoices"("due_date");

-- CreateIndex
CREATE INDEX "agent_inventory_logs_inventory_id_idx" ON "agent_inventory_logs"("inventory_id");

-- CreateIndex
CREATE INDEX "agent_inventory_logs_client_id_idx" ON "agent_inventory_logs"("client_id");

-- CreateIndex
CREATE INDEX "agent_inventory_logs_created_at_idx" ON "agent_inventory_logs"("created_at");

-- CreateIndex
CREATE INDEX "agent_reorder_requests_client_id_idx" ON "agent_reorder_requests"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_emails_gmail_message_id_key" ON "agent_emails"("gmail_message_id");

-- CreateIndex
CREATE INDEX "agent_emails_client_id_idx" ON "agent_emails"("client_id");

-- CreateIndex
CREATE INDEX "agent_emails_classification_idx" ON "agent_emails"("classification");

-- CreateIndex
CREATE INDEX "agent_emails_received_at_idx" ON "agent_emails"("received_at");

-- CreateIndex
CREATE INDEX "script_mutations_niche_idx" ON "script_mutations"("niche");

-- CreateIndex
CREATE INDEX "script_mutations_status_idx" ON "script_mutations"("status");

-- CreateIndex
CREATE INDEX "ai_decisions_type_idx" ON "ai_decisions"("type");

-- CreateIndex
CREATE INDEX "ai_decisions_niche_idx" ON "ai_decisions"("niche");

-- CreateIndex
CREATE INDEX "script_ab_tests_niche_idx" ON "script_ab_tests"("niche");

-- CreateIndex
CREATE INDEX "objection_handlers_niche_idx" ON "objection_handlers"("niche");

-- CreateIndex
CREATE INDEX "objection_handlers_language_idx" ON "objection_handlers"("language");

-- CreateIndex
CREATE INDEX "script_versions_niche_language_idx" ON "script_versions"("niche", "language");

-- CreateIndex
CREATE INDEX "opening_variants_niche_language_idx" ON "opening_variants"("niche", "language");

-- CreateIndex
CREATE UNIQUE INDEX "niche_best_times_niche_day_of_week_hour_utc_key" ON "niche_best_times"("niche", "day_of_week", "hour_utc");

-- CreateIndex
CREATE UNIQUE INDEX "local_presence_numbers_phone_number_key" ON "local_presence_numbers"("phone_number");

-- CreateIndex
CREATE INDEX "local_presence_numbers_area_code_idx" ON "local_presence_numbers"("area_code");

-- CreateIndex
CREATE INDEX "follow_up_sequences_prospect_id_idx" ON "follow_up_sequences"("prospect_id");

-- CreateIndex
CREATE INDEX "follow_up_sequences_scheduled_at_idx" ON "follow_up_sequences"("scheduled_at");

-- CreateIndex
CREATE INDEX "follow_up_sequences_sent_at_idx" ON "follow_up_sequences"("sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "prospect_booking_slots_token_key" ON "prospect_booking_slots"("token");

-- CreateIndex
CREATE INDEX "prospect_booking_slots_token_idx" ON "prospect_booking_slots"("token");

-- CreateIndex
CREATE INDEX "prospect_booking_slots_status_idx" ON "prospect_booking_slots"("status");

-- CreateIndex
CREATE INDEX "prospect_booking_slots_prospect_id_idx" ON "prospect_booking_slots"("prospect_id");

-- CreateIndex
CREATE INDEX "agent_anomalies_metric_name_idx" ON "agent_anomalies"("metric_name");

-- CreateIndex
CREATE INDEX "agent_anomalies_severity_idx" ON "agent_anomalies"("severity");

-- CreateIndex
CREATE INDEX "agent_anomalies_created_at_idx" ON "agent_anomalies"("created_at");

-- CreateIndex
CREATE INDEX "agent_strategies_agent_type_idx" ON "agent_strategies"("agent_type");

-- CreateIndex
CREATE INDEX "agent_strategies_niche_idx" ON "agent_strategies"("niche");

-- CreateIndex
CREATE INDEX "agent_strategies_is_active_idx" ON "agent_strategies"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "agent_strategies_agent_type_niche_language_is_active_key" ON "agent_strategies"("agent_type", "niche", "language", "is_active");

-- CreateIndex
CREATE INDEX "agent_actions_agent_type_idx" ON "agent_actions"("agent_type");

-- CreateIndex
CREATE INDEX "agent_actions_niche_idx" ON "agent_actions"("niche");

-- CreateIndex
CREATE INDEX "agent_actions_outcome_idx" ON "agent_actions"("outcome");

-- CreateIndex
CREATE INDEX "agent_actions_created_at_idx" ON "agent_actions"("created_at");

-- CreateIndex
CREATE INDEX "agent_insights_source_agent_idx" ON "agent_insights"("source_agent");

-- CreateIndex
CREATE INDEX "agent_insights_niche_idx" ON "agent_insights"("niche");

-- CreateIndex
CREATE INDEX "agent_insights_is_active_idx" ON "agent_insights"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_slug_key" ON "agencies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_owner_id_key" ON "agencies"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "agency_clients_agency_id_client_id_key" ON "agency_clients"("agency_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- AddForeignKey
ALTER TABLE "linkedin_outreach" ADD CONSTRAINT "linkedin_outreach_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_sends" ADD CONSTRAINT "campaign_sends_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_sends" ADD CONSTRAINT "campaign_sends_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_calls" ADD CONSTRAINT "client_calls_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_bookings" ADD CONSTRAINT "client_bookings_client_call_id_fkey" FOREIGN KEY ("client_call_id") REFERENCES "client_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_bookings" ADD CONSTRAINT "client_bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_analytics_daily" ADD CONSTRAINT "client_analytics_daily_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_transfers" ADD CONSTRAINT "call_transfers_client_call_id_fkey" FOREIGN KEY ("client_call_id") REFERENCES "client_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_transfers" ADD CONSTRAINT "call_transfers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_fingerprints" ADD CONSTRAINT "trial_fingerprints_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_acceptances" ADD CONSTRAINT "contract_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "client_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_integrations" ADD CONSTRAINT "crm_integrations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_subscriptions" ADD CONSTRAINT "agent_subscriptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_marketing_configs" ADD CONSTRAINT "agent_marketing_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_marketing_activities" ADD CONSTRAINT "agent_marketing_activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_reputation_configs" ADD CONSTRAINT "agent_reputation_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_reputation_activities" ADD CONSTRAINT "agent_reputation_activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_scheduling_configs" ADD CONSTRAINT "agent_scheduling_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_scheduling_activities" ADD CONSTRAINT "agent_scheduling_activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_support_configs" ADD CONSTRAINT "agent_support_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_support_activities" ADD CONSTRAINT "agent_support_activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_crm_configs" ADD CONSTRAINT "agent_crm_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_crm_activities" ADD CONSTRAINT "agent_crm_activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_document_configs" ADD CONSTRAINT "agent_document_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_document_activities" ADD CONSTRAINT "agent_document_activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_local_seo_configs" ADD CONSTRAINT "agent_local_seo_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_local_seo_activities" ADD CONSTRAINT "agent_local_seo_activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_lead_gen_configs" ADD CONSTRAINT "agent_lead_gen_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_lead_gen_activities" ADD CONSTRAINT "agent_lead_gen_activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_analytics_configs" ADD CONSTRAINT "agent_analytics_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_analytics_activities" ADD CONSTRAINT "agent_analytics_activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_email_configs" ADD CONSTRAINT "agent_email_configs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_inventory" ADD CONSTRAINT "agent_inventory_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_accounting" ADD CONSTRAINT "agent_accounting_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_expenses" ADD CONSTRAINT "agent_expenses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_income" ADD CONSTRAINT "agent_income_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_financial_reports" ADD CONSTRAINT "agent_financial_reports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_invoices" ADD CONSTRAINT "agent_invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_inventory_logs" ADD CONSTRAINT "agent_inventory_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_inventory_logs" ADD CONSTRAINT "agent_inventory_logs_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "agent_inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_reorder_requests" ADD CONSTRAINT "agent_reorder_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_reorder_requests" ADD CONSTRAINT "agent_reorder_requests_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "agent_inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_emails" ADD CONSTRAINT "agent_emails_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_sequences" ADD CONSTRAINT "follow_up_sequences_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_booking_slots" ADD CONSTRAINT "prospect_booking_slots_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_clients" ADD CONSTRAINT "agency_clients_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_clients" ADD CONSTRAINT "agency_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

