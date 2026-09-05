-- Runtime records live in Firestore. These tables provide durable GCP analytics
-- for staffing plans, planned material quantities and actual daily expenses.
CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.staff_cost_plan` (
  employee_id STRING NOT NULL,
  employee_name STRING NOT NULL,
  role STRING NOT NULL,
  base_salary_inr NUMERIC NOT NULL,
  allowance_inr NUMERIC NOT NULL,
  monthly_total_inr NUMERIC NOT NULL,
  needs_confirmation BOOL NOT NULL,
  effective_from DATE NOT NULL,
  active BOOL NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY active, employee_id;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.operations_material_plan` (
  plan_group STRING NOT NULL,
  menu_item STRING NOT NULL,
  planned_output_min INT64,
  planned_output_max INT64,
  output_unit STRING,
  ingredient STRING NOT NULL,
  quantity NUMERIC NOT NULL,
  quantity_unit STRING NOT NULL,
  needs_confirmation BOOL NOT NULL,
  note STRING,
  active BOOL NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY plan_group, menu_item, active;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.daily_operating_expenses` (
  service_date DATE NOT NULL,
  kitchen_id STRING NOT NULL,
  gas_inr NUMERIC NOT NULL,
  water_inr NUMERIC NOT NULL,
  cleaning_inr NUMERIC NOT NULL,
  transport_inr NUMERIC NOT NULL,
  utilities_inr NUMERIC NOT NULL,
  repairs_inr NUMERIC NOT NULL,
  other_inr NUMERIC NOT NULL,
  total_inr NUMERIC NOT NULL,
  notes STRING,
  updated_by STRING,
  updated_at TIMESTAMP NOT NULL
)
PARTITION BY service_date
CLUSTER BY kitchen_id;

MERGE `YOUR_PROJECT_ID.school_lunch.staff_cost_plan` T
USING UNNEST([
  STRUCT("stephen" AS employee_id, "Stephen" AS employee_name, "Delivery Lead" AS role, NUMERIC "35000" AS base_salary_inr, NUMERIC "5000" AS allowance_inr, FALSE AS needs_confirmation),
  STRUCT("malathy", "Malathy", "Marketing", NUMERIC "90000", NUMERIC "0", FALSE),
  STRUCT("archana", "Archana", "Operational Manager", NUMERIC "30000", NUMERIC "0", FALSE),
  STRUCT("sister", "Sister", "Role not recorded", NUMERIC "22000", NUMERIC "0", TRUE),
  STRUCT("anu", "Anu", "Data Engineer", NUMERIC "23000", NUMERIC "0", FALSE),
  STRUCT("devika", "Devika", "People Manager", NUMERIC "25000", NUMERIC "0", FALSE),
  STRUCT("sweety-annie", "Sweety Annie", "Nutrition role (unconfirmed)", NUMERIC "30000", NUMERIC "0", TRUE)
]) S
ON T.employee_id = S.employee_id AND T.effective_from = DATE "2026-08-07"
WHEN MATCHED THEN UPDATE SET employee_name=S.employee_name, role=S.role, base_salary_inr=S.base_salary_inr, allowance_inr=S.allowance_inr, monthly_total_inr=S.base_salary_inr+S.allowance_inr, needs_confirmation=S.needs_confirmation, active=TRUE, updated_at=CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (employee_id,employee_name,role,base_salary_inr,allowance_inr,monthly_total_inr,needs_confirmation,effective_from,active,updated_at) VALUES (S.employee_id,S.employee_name,S.role,S.base_salary_inr,S.allowance_inr,S.base_salary_inr+S.allowance_inr,S.needs_confirmation,DATE "2026-08-07",TRUE,CURRENT_TIMESTAMP());

MERGE `YOUR_PROJECT_ID.school_lunch.operations_material_plan` T
USING UNNEST([
  STRUCT("lunch" AS plan_group,"General lunch" AS menu_item,CAST(NULL AS INT64) AS planned_output_min,CAST(NULL AS INT64) AS planned_output_max,"batch" AS output_unit,"Rice" AS ingredient,NUMERIC "2" AS quantity,"kg" AS quantity_unit,FALSE AS needs_confirmation,CAST(NULL AS STRING) AS note),
  STRUCT("lunch","General lunch",NULL,NULL,"batch","Dal",NUMERIC "400","g",FALSE,NULL),
  STRUCT("lunch","General lunch",NULL,NULL,"batch","Oil",NUMERIC "300","ml",FALSE,NULL),
  STRUCT("lunch","General lunch",NULL,NULL,"batch","Masala",NUMERIC "300","g",FALSE,NULL),
  STRUCT("lunch","General lunch",NULL,NULL,"batch","Vegetables",NUMERIC "2","kg",FALSE,NULL),
  STRUCT("lunch","General lunch",NULL,NULL,"batch","Gas",NUMERIC "1","kg",FALSE,NULL),
  STRUCT("lunch","General lunch",NULL,NULL,"batch","Water",NUMERIC "500","litres",FALSE,NULL),
  STRUCT("lunch","General lunch",NULL,NULL,"batch","Vessel-cleaning liquid",NUMERIC "100","ml",FALSE,NULL),
  STRUCT("lunch","General lunch",NULL,NULL,"batch","Other dals",NUMERIC "250","g",FALSE,NULL),
  STRUCT("morning","Idly",55,75,"nos","Rice and urad dal",NUMERIC "1.5","kg",TRUE,"Output count needs confirmation"),
  STRUCT("morning","Dosa",40,40,"nos","Batter",NUMERIC "1.5","kg",TRUE,"Output count needs confirmation"),
  STRUCT("morning","Supporting ingredients",NULL,NULL,"batch","Oil",NUMERIC "300","ml",FALSE,NULL),
  STRUCT("morning","Supporting ingredients",NULL,NULL,"batch","Gas",NUMERIC "500","g",FALSE,NULL),
  STRUCT("morning","Supporting ingredients",NULL,NULL,"batch","Dal / sambar",NUMERIC "400","g",FALSE,NULL),
  STRUCT("morning","Supporting ingredients",NULL,NULL,"batch","Vegetables",NUMERIC "1","kg",FALSE,NULL),
  STRUCT("morning","Supporting ingredients",NULL,NULL,"batch","Masala",NUMERIC "300","g",FALSE,NULL),
  STRUCT("morning","Chapati",35,44,"nos","Wheat flour",NUMERIC "1.5","kg",TRUE,"Output count needs confirmation"),
  STRUCT("morning","Chapati",35,44,"nos","Peas for kurma",NUMERIC "400","g",TRUE,"Output count needs confirmation"),
  STRUCT("morning","Chapati",35,44,"nos","Vegetables for kurma",NUMERIC "1","kg",TRUE,"Output count needs confirmation"),
  STRUCT("morning","Chapati",35,44,"nos","Masala",NUMERIC "200","g",TRUE,"Output count needs confirmation"),
  STRUCT("morning","Chapati",35,44,"nos","Oil",NUMERIC "300","ml",TRUE,"Output count needs confirmation"),
  STRUCT("morning","Pongal",NULL,NULL,"batch","Rice",NUMERIC "1.5","kg",FALSE,NULL),
  STRUCT("morning","Pongal",NULL,NULL,"batch","Pasi paruppu / moong dal",NUMERIC "400","g",FALSE,NULL),
  STRUCT("morning","Pongal",NULL,NULL,"batch","Sambar dal",NUMERIC "250","g",FALSE,NULL),
  STRUCT("morning","Pongal",NULL,NULL,"batch","Oil",NUMERIC "200","ml",FALSE,NULL),
  STRUCT("morning","Pongal",NULL,NULL,"batch","Ghee",NUMERIC "100","ml",FALSE,NULL),
  STRUCT("morning","Coconut chutney",NULL,NULL,"batch","Pottukadalai / roasted gram",NUMERIC "250","g",FALSE,NULL),
  STRUCT("morning","Coconut chutney",NULL,NULL,"batch","Coconut",NUMERIC "1","number",FALSE,NULL),
  STRUCT("morning","Vada",15,15,"nos","Ulundhu / urad dal",NUMERIC "500","g",FALSE,NULL),
  STRUCT("morning","Vada",15,15,"nos","Oil",NUMERIC "250","ml",TRUE,"Oil quantity and unit need confirmation")
]) S
ON T.plan_group=S.plan_group AND T.menu_item=S.menu_item AND T.ingredient=S.ingredient
WHEN MATCHED THEN UPDATE SET planned_output_min=S.planned_output_min,planned_output_max=S.planned_output_max,output_unit=S.output_unit,quantity=S.quantity,quantity_unit=S.quantity_unit,needs_confirmation=S.needs_confirmation,note=S.note,active=TRUE,updated_at=CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (plan_group,menu_item,planned_output_min,planned_output_max,output_unit,ingredient,quantity,quantity_unit,needs_confirmation,note,active,updated_at) VALUES (S.plan_group,S.menu_item,S.planned_output_min,S.planned_output_max,S.output_unit,S.ingredient,S.quantity,S.quantity_unit,S.needs_confirmation,S.note,TRUE,CURRENT_TIMESTAMP());
