--
-- PostgreSQL database dump
--

\restrict nakyBcuYcn08s4NzRrYlK0oZ8Ijlevbhw5suofIq8dGHJebLUkYP4CfxiruJ8TX

-- Dumped from database version 15.14 (Debian 15.14-0+deb12u1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-0+deb12u1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: trg_wallet_balance_update_fn(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_wallet_balance_update_fn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tx_type = 'credit' THEN
      UPDATE wallets SET balance = balance + NEW.amount WHERE id = NEW.wallet_id;
    ELSIF NEW.tx_type = 'debit' THEN
      UPDATE wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
    ELSIF NEW.tx_type = 'transfer' THEN
      UPDATE wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
      IF NEW.related_wallet_id IS NOT NULL THEN
        UPDATE wallets SET balance = balance + NEW.amount WHERE id = NEW.related_wallet_id;
      END IF;
    ELSIF NEW.tx_type = 'adjustment' THEN
      UPDATE wallets SET balance = balance + NEW.amount WHERE id = NEW.wallet_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(255) NOT NULL,
    provider character varying(255) NOT NULL,
    provider_account_id character varying(255) NOT NULL,
    refresh_token text,
    access_token text,
    expires_at bigint,
    token_type character varying(255),
    scope character varying(255),
    id_token text,
    session_state character varying(255)
);


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    project_id integer,
    related_entity text,
    related_id integer,
    actor_id integer,
    action text,
    comment text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approvals (
    id integer NOT NULL,
    related_entity text,
    related_id integer,
    requested_by integer,
    approved_by integer,
    approval_status text DEFAULT 'pending'::text,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT approvals_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: approvals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approvals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approvals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approvals_id_seq OWNED BY public.approvals.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    user_id integer,
    action text,
    entity text,
    entity_id integer,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: biz_model_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.biz_model_milestones (
    id integer NOT NULL,
    biz_model_id integer,
    milestone_code text NOT NULL,
    milestone_name text NOT NULL,
    direction text NOT NULL,
    stage_code text,
    description text,
    is_mandatory boolean DEFAULT true,
    sequence_order integer,
    created_at timestamp with time zone DEFAULT now(),
    woodwork_percentage numeric(9,4) DEFAULT 0,
    misc_percentage numeric(9,4) DEFAULT 0,
    CONSTRAINT biz_model_milestones_direction_check CHECK ((direction = ANY (ARRAY['inflow'::text, 'outflow'::text])))
);


--
-- Name: COLUMN biz_model_milestones.woodwork_percentage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.biz_model_milestones.woodwork_percentage IS 'Cumulative percentage to be collected for woodwork items by this milestone';


--
-- Name: COLUMN biz_model_milestones.misc_percentage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.biz_model_milestones.misc_percentage IS 'Cumulative percentage to be collected for misc items by this milestone';


--
-- Name: biz_model_milestones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.biz_model_milestones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: biz_model_milestones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.biz_model_milestones_id_seq OWNED BY public.biz_model_milestones.id;


--
-- Name: biz_model_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.biz_model_stages (
    id integer NOT NULL,
    biz_model_id integer,
    stage_code text NOT NULL,
    stage_name text NOT NULL,
    sequence_order integer NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: biz_model_stages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.biz_model_stages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: biz_model_stages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.biz_model_stages_id_seq OWNED BY public.biz_model_stages.id;


--
-- Name: biz_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.biz_models (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    version text NOT NULL,
    description text,
    service_charge_percentage numeric(9,4) DEFAULT 0,
    max_discount_percentage numeric(9,4) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'draft'::text,
    CONSTRAINT biz_models_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: COLUMN biz_models.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.biz_models.status IS 'Status of business model: draft or published. Only published models can be used in projects.';


--
-- Name: biz_models_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.biz_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: biz_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.biz_models_id_seq OWNED BY public.biz_models.id;


--
-- Name: credit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_notes (
    id integer NOT NULL,
    note_number text,
    issued_by_type text,
    issued_by_id integer,
    related_wallet_id integer,
    project_id integer,
    amount numeric(20,2) NOT NULL,
    note_type text,
    issued_at timestamp with time zone DEFAULT now(),
    reason text,
    status text DEFAULT 'draft'::text,
    applied_to_source_table text,
    applied_to_source_id integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT credit_notes_issued_by_type_check CHECK ((issued_by_type = ANY (ARRAY['kg'::text, 'vendor'::text, 'customer'::text]))),
    CONSTRAINT credit_notes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'applied'::text, 'cancelled'::text])))
);


--
-- Name: credit_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credit_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credit_notes_id_seq OWNED BY public.credit_notes.id;


--
-- Name: customer_kyc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_kyc (
    id integer NOT NULL,
    customer_id integer,
    document_type text,
    document_url text,
    file_metadata jsonb DEFAULT '{}'::jsonb,
    submitted_by integer,
    submitted_at timestamp with time zone DEFAULT now(),
    finance_approved_by integer,
    finance_approval_status text DEFAULT 'pending'::text,
    finance_approval_at timestamp with time zone,
    remarks text,
    CONSTRAINT customer_kyc_finance_approval_status_check CHECK ((finance_approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: customer_kyc_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_kyc_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_kyc_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_kyc_id_seq OWNED BY public.customer_kyc.id;


--
-- Name: customer_payments_in; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_payments_in (
    id integer NOT NULL,
    project_id integer,
    estimation_id integer,
    project_financial_event_id integer,
    customer_id integer,
    payment_type text,
    amount numeric(20,2) NOT NULL,
    payment_date timestamp with time zone DEFAULT now(),
    mode text DEFAULT 'bank'::text,
    reference_number text,
    remarks text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    milestone_id integer,
    expected_percentage numeric(9,4),
    actual_percentage numeric(9,4),
    override_reason text,
    receipt_url text,
    status text DEFAULT 'pending'::text,
    approved_by integer,
    approved_at timestamp with time zone,
    woodwork_amount numeric(20,2) DEFAULT 0,
    misc_amount numeric(20,2) DEFAULT 0,
    pre_tax_amount numeric(20,2) DEFAULT 0,
    gst_amount numeric(20,2) DEFAULT 0,
    gst_percentage numeric(5,2) DEFAULT 0,
    credit_note_url text,
    CONSTRAINT customer_payments_in_mode_check CHECK ((mode = ANY (ARRAY['cash'::text, 'bank'::text, 'cheque'::text, 'upi'::text, 'wallet'::text, 'other'::text]))),
    CONSTRAINT customer_payments_in_payment_type_check CHECK (((payment_type IS NOT NULL) AND (length(payment_type) > 0))),
    CONSTRAINT customer_payments_in_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: COLUMN customer_payments_in.payment_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_payments_in.payment_type IS 'Payment type: milestone code from biz_model_milestones or MISC for ad-hoc payments';


--
-- Name: COLUMN customer_payments_in.receipt_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_payments_in.receipt_url IS 'URL to uploaded payment receipt document';


--
-- Name: COLUMN customer_payments_in.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_payments_in.status IS 'Payment status: pending, approved, rejected';


--
-- Name: COLUMN customer_payments_in.woodwork_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_payments_in.woodwork_amount IS 'Amount allocated to woodwork category';


--
-- Name: COLUMN customer_payments_in.misc_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_payments_in.misc_amount IS 'Amount allocated to misc category';


--
-- Name: COLUMN customer_payments_in.pre_tax_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_payments_in.pre_tax_amount IS 'Amount before GST (back-calculated from total)';


--
-- Name: COLUMN customer_payments_in.gst_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_payments_in.gst_amount IS 'GST amount (back-calculated from total using project GST%)';


--
-- Name: COLUMN customer_payments_in.gst_percentage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_payments_in.gst_percentage IS 'GST percentage used for this payment (from estimation)';


--
-- Name: customer_payments_in_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_payments_in_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_payments_in_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_payments_in_id_seq OWNED BY public.customer_payments_in.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    name text NOT NULL,
    contact_person text,
    phone text,
    email text,
    address text,
    gst_number text,
    credit_limit numeric(18,2) DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    kyc_type text,
    business_type text,
    bank_details jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT customers_business_type_check CHECK ((business_type = ANY (ARRAY['B2B'::text, 'B2C'::text]))),
    CONSTRAINT customers_kyc_type_check CHECK ((kyc_type = ANY (ARRAY['aadhar'::text, 'pan'::text, 'blank_cheque'::text, 'none'::text])))
);


--
-- Name: COLUMN customers.kyc_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.kyc_type IS 'Type of KYC document: aadhar, pan, blank_cheque, or none';


--
-- Name: COLUMN customers.business_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.business_type IS 'Business type: B2B or B2C';


--
-- Name: COLUMN customers.bank_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customers.bank_details IS 'Bank account details: {account_number, ifsc_code, bank_name, branch_name}';


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: debit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.debit_notes (
    id integer NOT NULL,
    note_number text,
    issued_by_type text,
    issued_by_id integer,
    related_wallet_id integer,
    project_id integer,
    amount numeric(20,2) NOT NULL,
    note_type text,
    issued_at timestamp with time zone DEFAULT now(),
    reason text,
    status text DEFAULT 'draft'::text,
    applied_to_source_table text,
    applied_to_source_id integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT debit_notes_issued_by_type_check CHECK ((issued_by_type = ANY (ARRAY['kg'::text, 'vendor'::text, 'customer'::text]))),
    CONSTRAINT debit_notes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'applied'::text, 'cancelled'::text])))
);


--
-- Name: debit_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.debit_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: debit_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.debit_notes_id_seq OWNED BY public.debit_notes.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    related_entity text,
    related_id integer,
    document_type text,
    file_url text,
    file_metadata jsonb DEFAULT '{}'::jsonb,
    version integer DEFAULT 1,
    uploaded_by integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE documents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.documents IS 'Centralized document storage for all entities';


--
-- Name: COLUMN documents.related_entity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documents.related_entity IS 'Entity type: customer, project, payment, vendor';


--
-- Name: COLUMN documents.related_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.documents.related_id IS 'ID of the related entity';


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: estimation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimation_items (
    id integer NOT NULL,
    estimation_id integer,
    category text,
    description text NOT NULL,
    quantity numeric(18,4) DEFAULT 1,
    unit text,
    unit_price numeric(20,4) DEFAULT 0,
    total numeric(22,2) GENERATED ALWAYS AS ((quantity * unit_price)) STORED,
    vendor_type text,
    estimated_cost numeric(20,2) DEFAULT 0,
    actual_cost numeric(20,2),
    estimated_margin numeric(9,4),
    actual_margin numeric(9,4),
    linked_vendor_boq_item_id integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT estimation_items_category_check CHECK ((category = ANY (ARRAY['woodwork'::text, 'misc_internal'::text, 'misc_external'::text]))),
    CONSTRAINT estimation_items_vendor_type_check CHECK ((vendor_type = ANY (ARRAY['PI'::text, 'Aristo'::text, 'Other'::text])))
);


--
-- Name: estimation_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estimation_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estimation_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estimation_items_id_seq OWNED BY public.estimation_items.id;


--
-- Name: financial_event_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_event_definitions (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    direction text NOT NULL,
    default_percentage numeric(9,4),
    default_trigger_phase text,
    applicable_to text DEFAULT 'project'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT financial_event_definitions_applicable_to_check CHECK ((applicable_to = ANY (ARRAY['customer'::text, 'vendor'::text, 'project'::text]))),
    CONSTRAINT financial_event_definitions_direction_check CHECK ((direction = ANY (ARRAY['inflow'::text, 'outflow'::text])))
);


--
-- Name: financial_event_definitions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financial_event_definitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financial_event_definitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financial_event_definitions_id_seq OWNED BY public.financial_event_definitions.id;


--
-- Name: payments_out; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments_out (
    id integer NOT NULL,
    vendor_id integer,
    vendor_boq_id integer,
    project_id integer,
    project_financial_event_id integer,
    payment_stage text,
    amount numeric(20,2) NOT NULL,
    payment_date timestamp with time zone DEFAULT now(),
    mode text,
    reference_number text,
    remarks text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    milestone_id integer,
    expected_percentage numeric(9,4),
    actual_percentage numeric(9,4),
    CONSTRAINT payments_out_payment_stage_check CHECK ((payment_stage = ANY (ARRAY['advance'::text, 'in_progress'::text, 'handover'::text, 'final'::text, 'other'::text])))
);


--
-- Name: payments_out_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_out_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_out_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_out_id_seq OWNED BY public.payments_out.id;


--
-- Name: project_collaborators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_collaborators (
    id integer NOT NULL,
    project_id integer,
    user_id integer,
    role text NOT NULL,
    permissions jsonb DEFAULT '{}'::jsonb,
    added_at timestamp with time zone DEFAULT now(),
    CONSTRAINT project_collaborators_role_check CHECK ((role = ANY (ARRAY['estimator'::text, 'sales'::text, 'designer'::text, 'project_manager'::text, 'finance'::text, 'other'::text])))
);


--
-- Name: project_collaborators_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_collaborators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_collaborators_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_collaborators_id_seq OWNED BY public.project_collaborators.id;


--
-- Name: project_estimations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_estimations (
    id integer NOT NULL,
    project_id integer,
    version integer DEFAULT 1,
    total_value numeric(20,2) DEFAULT 0,
    woodwork_value numeric(20,2) DEFAULT 0,
    misc_internal_value numeric(20,2) DEFAULT 0,
    misc_external_value numeric(20,2) DEFAULT 0,
    remarks text,
    status text DEFAULT 'draft'::text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ai_metadata jsonb DEFAULT '{}'::jsonb,
    service_charge_percentage numeric(9,4) DEFAULT 0,
    service_charge_amount numeric(20,2) DEFAULT 0,
    discount_percentage numeric(9,4) DEFAULT 0,
    discount_amount numeric(20,2) DEFAULT 0,
    final_value numeric(20,2) DEFAULT 0,
    requires_approval boolean DEFAULT false,
    approval_status text DEFAULT 'approved'::text,
    approved_by integer,
    approved_at timestamp with time zone,
    gst_percentage numeric(5,2) DEFAULT 18.00,
    gst_amount numeric(12,2) DEFAULT 0.00,
    has_overpayment boolean DEFAULT false,
    overpayment_amount numeric(20,2) DEFAULT 0.00,
    overpayment_status text,
    CONSTRAINT project_estimations_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT project_estimations_overpayment_status_check CHECK ((overpayment_status = ANY (ARRAY['pending_approval'::text, 'approved'::text, 'rejected'::text, NULL::text]))),
    CONSTRAINT project_estimations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'finalized'::text, 'locked'::text])))
);


--
-- Name: COLUMN project_estimations.gst_percentage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_estimations.gst_percentage IS 'GST percentage for this estimation (default 18%)';


--
-- Name: COLUMN project_estimations.gst_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_estimations.gst_amount IS 'Calculated GST amount based on final_value';


--
-- Name: COLUMN project_estimations.has_overpayment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_estimations.has_overpayment IS 'True if this revision creates overpayment situation';


--
-- Name: COLUMN project_estimations.overpayment_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_estimations.overpayment_amount IS 'Amount of overpayment if estimation < collected';


--
-- Name: project_estimations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_estimations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_estimations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_estimations_id_seq OWNED BY public.project_estimations.id;


--
-- Name: project_financial_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_financial_events (
    id integer NOT NULL,
    project_id integer,
    event_definition_id integer,
    related_entity text,
    related_id integer,
    expected_percentage numeric(9,4),
    expected_amount numeric(20,2),
    actual_amount numeric(20,2),
    triggered_by integer,
    triggered_at timestamp with time zone,
    remarks text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT project_financial_events_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'triggered'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: project_financial_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_financial_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_financial_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_financial_events_id_seq OWNED BY public.project_financial_events.id;


--
-- Name: project_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_ledger (
    id integer NOT NULL,
    project_id integer,
    wallet_transaction_id bigint,
    source_table text,
    source_id integer,
    project_financial_event_id integer,
    entry_type text,
    amount numeric(20,2) NOT NULL,
    entry_date timestamp with time zone DEFAULT now(),
    remarks text,
    CONSTRAINT project_ledger_entry_type_check CHECK ((entry_type = ANY (ARRAY['credit'::text, 'debit'::text])))
);


--
-- Name: project_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_ledger_id_seq OWNED BY public.project_ledger.id;


--
-- Name: project_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_status_history (
    id integer NOT NULL,
    project_id integer,
    old_status text,
    new_status text,
    changed_by integer,
    changed_at timestamp with time zone DEFAULT now(),
    remarks text
);


--
-- Name: project_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_status_history_id_seq OWNED BY public.project_status_history.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    project_code text NOT NULL,
    customer_id integer,
    name text NOT NULL,
    location text,
    phase text DEFAULT 'onboarding'::text,
    status text DEFAULT 'active'::text,
    finance_locked boolean DEFAULT false,
    ai_metadata jsonb DEFAULT '{}'::jsonb,
    start_date date,
    end_date date,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    biz_model_id integer,
    sales_order_id text,
    invoice_url text,
    revenue_realized numeric(20,2) DEFAULT 0,
    invoice_uploaded_at timestamp with time zone,
    invoice_status text DEFAULT 'pending'::text,
    customer_credit numeric(20,2) DEFAULT 0.00,
    credit_note_url text,
    credit_note_uploaded_at timestamp with time zone,
    CONSTRAINT projects_invoice_status_check CHECK ((invoice_status = ANY (ARRAY['pending'::text, 'uploaded'::text, 'verified'::text]))),
    CONSTRAINT projects_phase_check CHECK ((phase = ANY (ARRAY['onboarding'::text, '2D'::text, '3D'::text, 'execution'::text, 'handover'::text])))
);


--
-- Name: COLUMN projects.invoice_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.invoice_url IS 'URL to uploaded project invoice';


--
-- Name: COLUMN projects.revenue_realized; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.revenue_realized IS 'Revenue realized from this project based on invoice';


--
-- Name: COLUMN projects.invoice_uploaded_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.invoice_uploaded_at IS 'Timestamp when invoice was uploaded';


--
-- Name: COLUMN projects.customer_credit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.customer_credit IS 'Credit balance available to customer due to overpayment';


--
-- Name: COLUMN projects.credit_note_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.credit_note_url IS 'URL of the credit note document';


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: purchase_order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_status_history (
    id integer NOT NULL,
    purchase_order_id integer,
    old_status text,
    new_status text,
    changed_by integer,
    changed_at timestamp with time zone DEFAULT now(),
    remarks text
);


--
-- Name: purchase_order_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_order_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_order_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_order_status_history_id_seq OWNED BY public.purchase_order_status_history.id;


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id integer NOT NULL,
    project_id integer,
    vendor_id integer,
    vendor_boq_id integer,
    po_number text,
    issue_date date,
    status text DEFAULT 'draft'::text,
    remarks text,
    total_value numeric(20,2),
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT purchase_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'dispatched'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_orders_id_seq OWNED BY public.purchase_orders.id;


--
-- Name: purchase_request_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_request_items (
    id integer NOT NULL,
    request_id integer,
    estimation_item_id integer,
    description text,
    quantity numeric(18,4) DEFAULT 1,
    unit text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: purchase_request_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_request_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_request_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_request_items_id_seq OWNED BY public.purchase_request_items.id;


--
-- Name: purchase_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_requests (
    id integer NOT NULL,
    project_id integer,
    estimation_id integer,
    request_number text,
    created_by integer,
    status text DEFAULT 'draft'::text,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT purchase_requests_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'responded'::text, 'cancelled'::text])))
);


--
-- Name: purchase_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_requests_id_seq OWNED BY public.purchase_requests.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    user_id integer,
    expires timestamp with time zone NOT NULL,
    session_token character varying(255) NOT NULL
);


--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255),
    email character varying(255) NOT NULL,
    email_verified timestamp with time zone,
    image character varying(255),
    role text DEFAULT 'sales'::text,
    active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['estimator'::text, 'finance'::text, 'sales'::text, 'designer'::text, 'project_manager'::text, 'admin'::text])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vendor_boq_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_boq_items (
    id integer NOT NULL,
    boq_id integer,
    estimation_item_id integer,
    description text,
    quantity numeric(18,4) DEFAULT 1,
    unit text,
    vendor_rate numeric(20,4) DEFAULT 0,
    total numeric(22,2) GENERATED ALWAYS AS ((quantity * vendor_rate)) STORED,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: vendor_boq_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vendor_boq_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vendor_boq_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vendor_boq_items_id_seq OWNED BY public.vendor_boq_items.id;


--
-- Name: vendor_boq_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_boq_status_history (
    id integer NOT NULL,
    vendor_boq_id integer,
    old_status text,
    new_status text,
    changed_by integer,
    changed_at timestamp with time zone DEFAULT now(),
    remarks text
);


--
-- Name: vendor_boq_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vendor_boq_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vendor_boq_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vendor_boq_status_history_id_seq OWNED BY public.vendor_boq_status_history.id;


--
-- Name: vendor_boqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_boqs (
    id integer NOT NULL,
    project_id integer,
    vendor_id integer,
    purchase_request_id integer,
    boq_code text,
    status text DEFAULT 'draft'::text,
    total_value numeric(20,2) DEFAULT 0,
    margin_percentage numeric(9,4),
    approval_required boolean DEFAULT false,
    approval_status text DEFAULT 'pending'::text,
    approval_by integer,
    approval_at timestamp with time zone,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT vendor_boqs_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT vendor_boqs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'in_progress'::text, 'completed'::text, 'rejected'::text])))
);


--
-- Name: vendor_boqs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vendor_boqs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vendor_boqs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vendor_boqs_id_seq OWNED BY public.vendor_boqs.id;


--
-- Name: vendor_rate_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_rate_cards (
    id integer NOT NULL,
    vendor_id integer,
    item_category text,
    sub_category text,
    unit text,
    rate numeric(20,2),
    effective_from date,
    effective_to date,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: vendor_rate_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vendor_rate_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vendor_rate_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vendor_rate_cards_id_seq OWNED BY public.vendor_rate_cards.id;


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id integer NOT NULL,
    name text NOT NULL,
    vendor_type text NOT NULL,
    contact_person text,
    phone text,
    email text,
    gst_number text,
    address text,
    is_active boolean DEFAULT true,
    credit_limit numeric(20,2) DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT vendors_vendor_type_check CHECK ((vendor_type = ANY (ARRAY['PI'::text, 'Aristo'::text, 'Other'::text])))
);


--
-- Name: vendors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vendors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vendors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vendors_id_seq OWNED BY public.vendors.id;


--
-- Name: verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_tokens (
    identifier character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    expires timestamp with time zone NOT NULL
);


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id bigint NOT NULL,
    wallet_id integer,
    tx_type text NOT NULL,
    amount numeric(24,2) NOT NULL,
    currency text DEFAULT 'INR'::text,
    related_wallet_id integer,
    reference text,
    source_table text,
    source_id integer,
    project_financial_event_id integer,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    remarks text,
    CONSTRAINT wallet_transactions_tx_type_check CHECK ((tx_type = ANY (ARRAY['credit'::text, 'debit'::text, 'transfer'::text, 'adjustment'::text])))
);


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wallet_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wallet_transactions_id_seq OWNED BY public.wallet_transactions.id;


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    id integer NOT NULL,
    wallet_code text,
    owner_type text NOT NULL,
    owner_id integer NOT NULL,
    currency text DEFAULT 'INR'::text,
    balance numeric(24,2) DEFAULT 0,
    status text DEFAULT 'active'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT wallets_owner_type_check CHECK ((owner_type = ANY (ARRAY['customer'::text, 'project'::text, 'vendor'::text, 'kg'::text]))),
    CONSTRAINT wallets_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'closed'::text])))
);


--
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wallets_id_seq OWNED BY public.wallets.id;


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: approvals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals ALTER COLUMN id SET DEFAULT nextval('public.approvals_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: biz_model_milestones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biz_model_milestones ALTER COLUMN id SET DEFAULT nextval('public.biz_model_milestones_id_seq'::regclass);


--
-- Name: biz_model_stages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biz_model_stages ALTER COLUMN id SET DEFAULT nextval('public.biz_model_stages_id_seq'::regclass);


--
-- Name: biz_models id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biz_models ALTER COLUMN id SET DEFAULT nextval('public.biz_models_id_seq'::regclass);


--
-- Name: credit_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes ALTER COLUMN id SET DEFAULT nextval('public.credit_notes_id_seq'::regclass);


--
-- Name: customer_kyc id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_kyc ALTER COLUMN id SET DEFAULT nextval('public.customer_kyc_id_seq'::regclass);


--
-- Name: customer_payments_in id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments_in ALTER COLUMN id SET DEFAULT nextval('public.customer_payments_in_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: debit_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debit_notes ALTER COLUMN id SET DEFAULT nextval('public.debit_notes_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: estimation_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimation_items ALTER COLUMN id SET DEFAULT nextval('public.estimation_items_id_seq'::regclass);


--
-- Name: financial_event_definitions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_event_definitions ALTER COLUMN id SET DEFAULT nextval('public.financial_event_definitions_id_seq'::regclass);


--
-- Name: payments_out id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments_out ALTER COLUMN id SET DEFAULT nextval('public.payments_out_id_seq'::regclass);


--
-- Name: project_collaborators id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_collaborators ALTER COLUMN id SET DEFAULT nextval('public.project_collaborators_id_seq'::regclass);


--
-- Name: project_estimations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_estimations ALTER COLUMN id SET DEFAULT nextval('public.project_estimations_id_seq'::regclass);


--
-- Name: project_financial_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_financial_events ALTER COLUMN id SET DEFAULT nextval('public.project_financial_events_id_seq'::regclass);


--
-- Name: project_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_ledger ALTER COLUMN id SET DEFAULT nextval('public.project_ledger_id_seq'::regclass);


--
-- Name: project_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_status_history ALTER COLUMN id SET DEFAULT nextval('public.project_status_history_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: purchase_order_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_status_history ALTER COLUMN id SET DEFAULT nextval('public.purchase_order_status_history_id_seq'::regclass);


--
-- Name: purchase_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders ALTER COLUMN id SET DEFAULT nextval('public.purchase_orders_id_seq'::regclass);


--
-- Name: purchase_request_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_request_items_id_seq'::regclass);


--
-- Name: purchase_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests ALTER COLUMN id SET DEFAULT nextval('public.purchase_requests_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vendor_boq_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boq_items ALTER COLUMN id SET DEFAULT nextval('public.vendor_boq_items_id_seq'::regclass);


--
-- Name: vendor_boq_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boq_status_history ALTER COLUMN id SET DEFAULT nextval('public.vendor_boq_status_history_id_seq'::regclass);


--
-- Name: vendor_boqs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boqs ALTER COLUMN id SET DEFAULT nextval('public.vendor_boqs_id_seq'::regclass);


--
-- Name: vendor_rate_cards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_rate_cards ALTER COLUMN id SET DEFAULT nextval('public.vendor_rate_cards_id_seq'::regclass);


--
-- Name: vendors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors ALTER COLUMN id SET DEFAULT nextval('public.vendors_id_seq'::regclass);


--
-- Name: wallet_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions ALTER COLUMN id SET DEFAULT nextval('public.wallet_transactions_id_seq'::regclass);


--
-- Name: wallets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets ALTER COLUMN id SET DEFAULT nextval('public.wallets_id_seq'::regclass);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_provider_provider_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_provider_provider_account_id_key UNIQUE (provider, provider_account_id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: biz_model_milestones biz_model_milestones_biz_model_id_milestone_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biz_model_milestones
    ADD CONSTRAINT biz_model_milestones_biz_model_id_milestone_code_key UNIQUE (biz_model_id, milestone_code);


--
-- Name: biz_model_milestones biz_model_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biz_model_milestones
    ADD CONSTRAINT biz_model_milestones_pkey PRIMARY KEY (id);


--
-- Name: biz_model_stages biz_model_stages_biz_model_id_stage_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biz_model_stages
    ADD CONSTRAINT biz_model_stages_biz_model_id_stage_code_key UNIQUE (biz_model_id, stage_code);


--
-- Name: biz_model_stages biz_model_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biz_model_stages
    ADD CONSTRAINT biz_model_stages_pkey PRIMARY KEY (id);


--
-- Name: biz_models biz_models_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biz_models
    ADD CONSTRAINT biz_models_code_key UNIQUE (code);


--
-- Name: biz_models biz_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biz_models
    ADD CONSTRAINT biz_models_pkey PRIMARY KEY (id);


--
-- Name: credit_notes credit_notes_note_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_note_number_key UNIQUE (note_number);


--
-- Name: credit_notes credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_pkey PRIMARY KEY (id);


--
-- Name: customer_kyc customer_kyc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_kyc
    ADD CONSTRAINT customer_kyc_pkey PRIMARY KEY (id);


--
-- Name: customer_payments_in customer_payments_in_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments_in
    ADD CONSTRAINT customer_payments_in_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: debit_notes debit_notes_note_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debit_notes
    ADD CONSTRAINT debit_notes_note_number_key UNIQUE (note_number);


--
-- Name: debit_notes debit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debit_notes
    ADD CONSTRAINT debit_notes_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: estimation_items estimation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimation_items
    ADD CONSTRAINT estimation_items_pkey PRIMARY KEY (id);


--
-- Name: financial_event_definitions financial_event_definitions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_event_definitions
    ADD CONSTRAINT financial_event_definitions_code_key UNIQUE (code);


--
-- Name: financial_event_definitions financial_event_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_event_definitions
    ADD CONSTRAINT financial_event_definitions_pkey PRIMARY KEY (id);


--
-- Name: payments_out payments_out_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments_out
    ADD CONSTRAINT payments_out_pkey PRIMARY KEY (id);


--
-- Name: project_collaborators project_collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_collaborators
    ADD CONSTRAINT project_collaborators_pkey PRIMARY KEY (id);


--
-- Name: project_collaborators project_collaborators_project_id_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_collaborators
    ADD CONSTRAINT project_collaborators_project_id_user_id_role_key UNIQUE (project_id, user_id, role);


--
-- Name: project_estimations project_estimations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_estimations
    ADD CONSTRAINT project_estimations_pkey PRIMARY KEY (id);


--
-- Name: project_financial_events project_financial_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_financial_events
    ADD CONSTRAINT project_financial_events_pkey PRIMARY KEY (id);


--
-- Name: project_ledger project_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_ledger
    ADD CONSTRAINT project_ledger_pkey PRIMARY KEY (id);


--
-- Name: project_status_history project_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_status_history
    ADD CONSTRAINT project_status_history_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_project_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_project_code_key UNIQUE (project_code);


--
-- Name: projects projects_sales_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_sales_order_id_key UNIQUE (sales_order_id);


--
-- Name: purchase_order_status_history purchase_order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_status_history
    ADD CONSTRAINT purchase_order_status_history_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: purchase_request_items purchase_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_items
    ADD CONSTRAINT purchase_request_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_requests purchase_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_pkey PRIMARY KEY (id);


--
-- Name: purchase_requests purchase_requests_request_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_request_number_key UNIQUE (request_number);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_session_token_key UNIQUE (session_token);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_boq_items vendor_boq_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boq_items
    ADD CONSTRAINT vendor_boq_items_pkey PRIMARY KEY (id);


--
-- Name: vendor_boq_status_history vendor_boq_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boq_status_history
    ADD CONSTRAINT vendor_boq_status_history_pkey PRIMARY KEY (id);


--
-- Name: vendor_boqs vendor_boqs_boq_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boqs
    ADD CONSTRAINT vendor_boqs_boq_code_key UNIQUE (boq_code);


--
-- Name: vendor_boqs vendor_boqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boqs
    ADD CONSTRAINT vendor_boqs_pkey PRIMARY KEY (id);


--
-- Name: vendor_rate_cards vendor_rate_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_rate_cards
    ADD CONSTRAINT vendor_rate_cards_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_identifier_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_identifier_token_key UNIQUE (identifier, token);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_wallet_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_wallet_code_key UNIQUE (wallet_code);


--
-- Name: idx_biz_model_milestones_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_biz_model_milestones_model ON public.biz_model_milestones USING btree (biz_model_id);


--
-- Name: idx_biz_model_stages_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_biz_model_stages_model ON public.biz_model_stages USING btree (biz_model_id);


--
-- Name: idx_biz_models_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_biz_models_code ON public.biz_models USING btree (code);


--
-- Name: idx_biz_models_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_biz_models_status ON public.biz_models USING btree (status);


--
-- Name: idx_documents_related; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_related ON public.documents USING btree (related_entity, related_id);


--
-- Name: idx_documents_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_type ON public.documents USING btree (document_type);


--
-- Name: idx_estimation_items_estimation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimation_items_estimation ON public.estimation_items USING btree (estimation_id);


--
-- Name: idx_estimations_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimations_project ON public.project_estimations USING btree (project_id);


--
-- Name: idx_fin_event_def_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_event_def_code ON public.financial_event_definitions USING btree (code);


--
-- Name: idx_project_fin_events_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_fin_events_project ON public.project_financial_events USING btree (project_id);


--
-- Name: idx_project_ledger_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_ledger_project ON public.project_ledger USING btree (project_id);


--
-- Name: idx_projects_biz_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_biz_model ON public.projects USING btree (biz_model_id);


--
-- Name: idx_projects_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_customer ON public.projects USING btree (customer_id);


--
-- Name: idx_projects_sales_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_sales_order ON public.projects USING btree (sales_order_id);


--
-- Name: idx_purchase_orders_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_project ON public.purchase_orders USING btree (project_id);


--
-- Name: idx_purchase_requests_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_requests_project ON public.purchase_requests USING btree (project_id);


--
-- Name: idx_vendor_boq_items_boq; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_boq_items_boq ON public.vendor_boq_items USING btree (boq_id);


--
-- Name: idx_vendor_boqs_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendor_boqs_project ON public.vendor_boqs USING btree (project_id);


--
-- Name: idx_wallet_transactions_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_transactions_wallet ON public.wallet_transactions USING btree (wallet_id);


--
-- Name: wallets_owner_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX wallets_owner_uq ON public.wallets USING btree (owner_type, owner_id);


--
-- Name: wallet_transactions trg_wallet_balance_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wallet_balance_update AFTER INSERT ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.trg_wallet_balance_update_fn();


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: activity_logs activity_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: activity_logs activity_logs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: approvals approvals_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: approvals approvals_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: biz_model_milestones biz_model_milestones_biz_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biz_model_milestones
    ADD CONSTRAINT biz_model_milestones_biz_model_id_fkey FOREIGN KEY (biz_model_id) REFERENCES public.biz_models(id) ON DELETE CASCADE;


--
-- Name: biz_model_stages biz_model_stages_biz_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biz_model_stages
    ADD CONSTRAINT biz_model_stages_biz_model_id_fkey FOREIGN KEY (biz_model_id) REFERENCES public.biz_models(id) ON DELETE CASCADE;


--
-- Name: credit_notes credit_notes_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: credit_notes credit_notes_related_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_related_wallet_id_fkey FOREIGN KEY (related_wallet_id) REFERENCES public.wallets(id);


--
-- Name: customer_kyc customer_kyc_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_kyc
    ADD CONSTRAINT customer_kyc_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_kyc customer_kyc_finance_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_kyc
    ADD CONSTRAINT customer_kyc_finance_approved_by_fkey FOREIGN KEY (finance_approved_by) REFERENCES public.users(id);


--
-- Name: customer_kyc customer_kyc_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_kyc
    ADD CONSTRAINT customer_kyc_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: customer_payments_in customer_payments_in_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments_in
    ADD CONSTRAINT customer_payments_in_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: customer_payments_in customer_payments_in_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments_in
    ADD CONSTRAINT customer_payments_in_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: customer_payments_in customer_payments_in_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments_in
    ADD CONSTRAINT customer_payments_in_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_payments_in customer_payments_in_estimation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments_in
    ADD CONSTRAINT customer_payments_in_estimation_id_fkey FOREIGN KEY (estimation_id) REFERENCES public.project_estimations(id);


--
-- Name: customer_payments_in customer_payments_in_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments_in
    ADD CONSTRAINT customer_payments_in_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.biz_model_milestones(id);


--
-- Name: customer_payments_in customer_payments_in_project_financial_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments_in
    ADD CONSTRAINT customer_payments_in_project_financial_event_id_fkey FOREIGN KEY (project_financial_event_id) REFERENCES public.project_financial_events(id);


--
-- Name: customer_payments_in customer_payments_in_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payments_in
    ADD CONSTRAINT customer_payments_in_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: debit_notes debit_notes_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debit_notes
    ADD CONSTRAINT debit_notes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: debit_notes debit_notes_related_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debit_notes
    ADD CONSTRAINT debit_notes_related_wallet_id_fkey FOREIGN KEY (related_wallet_id) REFERENCES public.wallets(id);


--
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: estimation_items estimation_items_estimation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimation_items
    ADD CONSTRAINT estimation_items_estimation_id_fkey FOREIGN KEY (estimation_id) REFERENCES public.project_estimations(id) ON DELETE CASCADE;


--
-- Name: payments_out payments_out_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments_out
    ADD CONSTRAINT payments_out_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: payments_out payments_out_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments_out
    ADD CONSTRAINT payments_out_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.biz_model_milestones(id);


--
-- Name: payments_out payments_out_project_financial_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments_out
    ADD CONSTRAINT payments_out_project_financial_event_id_fkey FOREIGN KEY (project_financial_event_id) REFERENCES public.project_financial_events(id);


--
-- Name: payments_out payments_out_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments_out
    ADD CONSTRAINT payments_out_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: payments_out payments_out_vendor_boq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments_out
    ADD CONSTRAINT payments_out_vendor_boq_id_fkey FOREIGN KEY (vendor_boq_id) REFERENCES public.vendor_boqs(id);


--
-- Name: payments_out payments_out_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments_out
    ADD CONSTRAINT payments_out_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: project_collaborators project_collaborators_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_collaborators
    ADD CONSTRAINT project_collaborators_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_collaborators project_collaborators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_collaborators
    ADD CONSTRAINT project_collaborators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: project_estimations project_estimations_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_estimations
    ADD CONSTRAINT project_estimations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: project_estimations project_estimations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_estimations
    ADD CONSTRAINT project_estimations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_estimations project_estimations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_estimations
    ADD CONSTRAINT project_estimations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_financial_events project_financial_events_event_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_financial_events
    ADD CONSTRAINT project_financial_events_event_definition_id_fkey FOREIGN KEY (event_definition_id) REFERENCES public.financial_event_definitions(id);


--
-- Name: project_financial_events project_financial_events_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_financial_events
    ADD CONSTRAINT project_financial_events_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_financial_events project_financial_events_triggered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_financial_events
    ADD CONSTRAINT project_financial_events_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES public.users(id);


--
-- Name: project_ledger project_ledger_project_financial_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_ledger
    ADD CONSTRAINT project_ledger_project_financial_event_id_fkey FOREIGN KEY (project_financial_event_id) REFERENCES public.project_financial_events(id);


--
-- Name: project_ledger project_ledger_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_ledger
    ADD CONSTRAINT project_ledger_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_status_history project_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_status_history
    ADD CONSTRAINT project_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: project_status_history project_status_history_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_status_history
    ADD CONSTRAINT project_status_history_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_biz_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_biz_model_id_fkey FOREIGN KEY (biz_model_id) REFERENCES public.biz_models(id);


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: projects projects_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: purchase_order_status_history purchase_order_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_status_history
    ADD CONSTRAINT purchase_order_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: purchase_order_status_history purchase_order_status_history_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_status_history
    ADD CONSTRAINT purchase_order_status_history_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: purchase_orders purchase_orders_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: purchase_orders purchase_orders_vendor_boq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_boq_id_fkey FOREIGN KEY (vendor_boq_id) REFERENCES public.vendor_boqs(id);


--
-- Name: purchase_orders purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: purchase_request_items purchase_request_items_estimation_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_items
    ADD CONSTRAINT purchase_request_items_estimation_item_id_fkey FOREIGN KEY (estimation_item_id) REFERENCES public.estimation_items(id);


--
-- Name: purchase_request_items purchase_request_items_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_items
    ADD CONSTRAINT purchase_request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.purchase_requests(id) ON DELETE CASCADE;


--
-- Name: purchase_requests purchase_requests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: purchase_requests purchase_requests_estimation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_estimation_id_fkey FOREIGN KEY (estimation_id) REFERENCES public.project_estimations(id);


--
-- Name: purchase_requests purchase_requests_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vendor_boq_items vendor_boq_items_boq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boq_items
    ADD CONSTRAINT vendor_boq_items_boq_id_fkey FOREIGN KEY (boq_id) REFERENCES public.vendor_boqs(id) ON DELETE CASCADE;


--
-- Name: vendor_boq_items vendor_boq_items_estimation_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boq_items
    ADD CONSTRAINT vendor_boq_items_estimation_item_id_fkey FOREIGN KEY (estimation_item_id) REFERENCES public.estimation_items(id);


--
-- Name: vendor_boq_status_history vendor_boq_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boq_status_history
    ADD CONSTRAINT vendor_boq_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: vendor_boq_status_history vendor_boq_status_history_vendor_boq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boq_status_history
    ADD CONSTRAINT vendor_boq_status_history_vendor_boq_id_fkey FOREIGN KEY (vendor_boq_id) REFERENCES public.vendor_boqs(id) ON DELETE CASCADE;


--
-- Name: vendor_boqs vendor_boqs_approval_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boqs
    ADD CONSTRAINT vendor_boqs_approval_by_fkey FOREIGN KEY (approval_by) REFERENCES public.users(id);


--
-- Name: vendor_boqs vendor_boqs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boqs
    ADD CONSTRAINT vendor_boqs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: vendor_boqs vendor_boqs_purchase_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boqs
    ADD CONSTRAINT vendor_boqs_purchase_request_id_fkey FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id);


--
-- Name: vendor_boqs vendor_boqs_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_boqs
    ADD CONSTRAINT vendor_boqs_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: vendor_rate_cards vendor_rate_cards_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_rate_cards
    ADD CONSTRAINT vendor_rate_cards_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: wallet_transactions wallet_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: wallet_transactions wallet_transactions_project_financial_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_project_financial_event_id_fkey FOREIGN KEY (project_financial_event_id) REFERENCES public.project_financial_events(id);


--
-- Name: wallet_transactions wallet_transactions_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict nakyBcuYcn08s4NzRrYlK0oZ8Ijlevbhw5suofIq8dGHJebLUkYP4CfxiruJ8TX

