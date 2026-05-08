-- Migration: 026_regulatory_parser.sql
-- Purpose: Create tables for regulatory document extraction system
-- Date: 2026-05-09
-- Dependencies: Must run after core auth and org tables are present

-- 1. regulatory_documents - Document registry
CREATE TABLE regulatory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_code VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  year INTEGER,
  organization VARCHAR(255),
  language VARCHAR(10) DEFAULT 'en',
  document_id_hash VARCHAR(64) UNIQUE NOT NULL,
  source_path TEXT,
  extraction_method VARCHAR(50),
  extraction_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  page_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_regulatory_documents_org_id ON regulatory_documents(org_id);
CREATE INDEX idx_regulatory_documents_code ON regulatory_documents(document_code);
CREATE INDEX idx_regulatory_documents_type ON regulatory_documents(document_type);
CREATE INDEX idx_regulatory_documents_hash ON regulatory_documents(document_id_hash);

-- 2. regulatory_sections - Document sections with hierarchy
CREATE TABLE regulatory_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  section_path TEXT[] NOT NULL,
  title TEXT NOT NULL,
  level INTEGER NOT NULL,
  content TEXT,
  page_start INTEGER,
  page_end INTEGER,
  parent_section_id UUID REFERENCES regulatory_sections(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_regulatory_sections_org_id ON regulatory_sections(org_id);
CREATE INDEX idx_regulatory_sections_document_id ON regulatory_sections(document_id);
CREATE INDEX idx_regulatory_sections_parent ON regulatory_sections(parent_section_id);

-- 3. extraction_formulas - Extracted formulas
CREATE TABLE extraction_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  formula_id_hash VARCHAR(64) UNIQUE NOT NULL,
  raw_text TEXT NOT NULL,
  symbolic_expression TEXT NOT NULL,
  latex_expression TEXT,
  source_page INTEGER,
  source_section VARCHAR(255),
  extraction_confidence FLOAT DEFAULT 0.5,
  extraction_method VARCHAR(50),
  extraction_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  review_status VARCHAR(50) DEFAULT 'PENDING_REVIEW',
  engineering_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_extraction_formulas_org_id ON extraction_formulas(org_id);
CREATE INDEX idx_extraction_formulas_document ON extraction_formulas(document_id);
CREATE INDEX idx_extraction_formulas_hash ON extraction_formulas(formula_id_hash);
CREATE INDEX idx_extraction_formulas_status ON extraction_formulas(review_status);

-- 4. extraction_variables - Variables in formulas
CREATE TABLE extraction_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  formula_id UUID NOT NULL REFERENCES extraction_formulas(id) ON DELETE CASCADE,
  variable_name VARCHAR(255) NOT NULL,
  latex_representation TEXT,
  subscript VARCHAR(50),
  superscript VARCHAR(50),
  description TEXT,
  symbol_definition TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_extraction_variables_org_id ON extraction_variables(org_id);
CREATE INDEX idx_extraction_variables_formula ON extraction_variables(formula_id);

-- 5. extraction_units - Units for variables
CREATE TABLE extraction_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  variable_id UUID NOT NULL REFERENCES extraction_variables(id) ON DELETE CASCADE,
  unit_text VARCHAR(255) NOT NULL,
  pint_representation VARCHAR(255),
  unit_type VARCHAR(100),
  is_si BOOLEAN DEFAULT FALSE,
  conversion_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_extraction_units_org_id ON extraction_units(org_id);
CREATE INDEX idx_extraction_units_variable ON extraction_units(variable_id);

-- 6. normative_references - Cross-document references
CREATE TABLE normative_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_document_id UUID REFERENCES regulatory_documents(id) ON DELETE SET NULL,
  target_document_code VARCHAR(255) NOT NULL,
  clause VARCHAR(255),
  page_reference INTEGER,
  reference_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_normative_references_org_id ON normative_references(org_id);
CREATE INDEX idx_normative_references_source ON normative_references(source_document_id);

-- 7. extraction_audit_log - Complete audit trail
CREATE TABLE extraction_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  formula_id UUID REFERENCES extraction_formulas(id) ON DELETE SET NULL,
  extraction_id VARCHAR(255),
  stage VARCHAR(100) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  extraction_hash VARCHAR(64),
  raw_source_fragment TEXT,
  extracted_structure JSONB DEFAULT '{}',
  normalization_steps TEXT[] DEFAULT ARRAY[]::TEXT[],
  validation_steps TEXT[] DEFAULT ARRAY[]::TEXT[],
  validation_passed BOOLEAN DEFAULT TRUE,
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_extraction_audit_org_id ON extraction_audit_log(org_id);
CREATE INDEX idx_extraction_audit_document ON extraction_audit_log(document_id);
CREATE INDEX idx_extraction_audit_formula ON extraction_audit_log(formula_id);
CREATE INDEX idx_extraction_audit_stage ON extraction_audit_log(stage);

-- 8. extraction_templates - Calculation templates
CREATE TABLE extraction_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_document_id UUID NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  template_name VARCHAR(255) NOT NULL,
  description TEXT,
  template_definition JSONB DEFAULT '{}',
  review_status VARCHAR(50) DEFAULT 'draft',
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  version VARCHAR(50) DEFAULT '0.1.0'
);

CREATE INDEX idx_extraction_templates_org_id ON extraction_templates(org_id);
CREATE INDEX idx_extraction_templates_status ON extraction_templates(review_status);

-- 9. template_review_queue - Human review workflow
CREATE TABLE template_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES extraction_templates(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT
);

CREATE INDEX idx_template_review_org_id ON template_review_queue(org_id);
CREATE INDEX idx_template_review_template ON template_review_queue(template_id);
CREATE INDEX idx_template_review_status ON template_review_queue(status);

-- 10. extraction_lineage - Complete provenance chain
CREATE TABLE extraction_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  formula_id UUID NOT NULL REFERENCES extraction_formulas(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  lineage_steps JSONB DEFAULT '[]',
  source_fragment_hash VARCHAR(64),
  final_hash VARCHAR(64),
  lineage_hash VARCHAR(64),
  is_deterministic BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_extraction_lineage_org_id ON extraction_lineage(org_id);
CREATE INDEX idx_extraction_lineage_formula ON extraction_lineage(formula_id);

-- RLS Policies (all tables isolated by org_id)

-- Enable RLS
ALTER TABLE regulatory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE normative_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_lineage ENABLE ROW LEVEL SECURITY;

-- RLS Policies: SELECT (view own org)
CREATE POLICY regulatory_documents_select ON regulatory_documents
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM org_members WHERE org_id = regulatory_documents.org_id
    )
  );

CREATE POLICY regulatory_sections_select ON regulatory_sections
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM org_members WHERE org_id = regulatory_sections.org_id
    )
  );

CREATE POLICY extraction_formulas_select ON extraction_formulas
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM org_members WHERE org_id = extraction_formulas.org_id
    )
  );

CREATE POLICY extraction_variables_select ON extraction_variables
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM org_members WHERE org_id = extraction_variables.org_id
    )
  );

CREATE POLICY extraction_units_select ON extraction_units
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM org_members WHERE org_id = extraction_units.org_id
    )
  );

CREATE POLICY normative_references_select ON normative_references
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM org_members WHERE org_id = normative_references.org_id
    )
  );

CREATE POLICY extraction_audit_log_select ON extraction_audit_log
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM org_members WHERE org_id = extraction_audit_log.org_id
    )
  );

CREATE POLICY extraction_templates_select ON extraction_templates
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM org_members WHERE org_id = extraction_templates.org_id
    )
  );

CREATE POLICY template_review_queue_select ON template_review_queue
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM org_members WHERE org_id = template_review_queue.org_id
    )
  );

CREATE POLICY extraction_lineage_select ON extraction_lineage
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM org_members WHERE org_id = extraction_lineage.org_id
    )
  );

-- RLS Policies: INSERT (with role check)
CREATE POLICY regulatory_documents_insert ON regulatory_documents
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM org_members
      WHERE org_id = regulatory_documents.org_id
      AND (role = 'ADMIN' OR role = 'ENGINEER')
    )
  );

CREATE POLICY extraction_formulas_insert ON extraction_formulas
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM org_members
      WHERE org_id = extraction_formulas.org_id
      AND (role = 'ADMIN' OR role = 'ENGINEER')
    )
  );

CREATE POLICY extraction_templates_insert ON extraction_templates
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM org_members
      WHERE org_id = extraction_templates.org_id
      AND (role = 'ADMIN' OR role = 'ENGINEER')
    )
  );

-- RLS Policies: UPDATE (with role check)
CREATE POLICY extraction_templates_update ON extraction_templates
  FOR UPDATE WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM org_members
      WHERE org_id = extraction_templates.org_id
      AND (role = 'ADMIN' OR role = 'GIP')
    )
  );

CREATE POLICY extraction_audit_log_update ON extraction_audit_log
  FOR UPDATE WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM org_members
      WHERE org_id = extraction_audit_log.org_id
      AND (role = 'ADMIN' OR role = 'GIP')
    )
  );
