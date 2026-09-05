MERGE `YOUR_PROJECT_ID.school_lunch.cities` T
USING UNNEST([
  STRUCT("chennai" AS city_id, "Chennai" AS city_name),
  STRUCT("madurai", "Madurai"),
  STRUCT("trichy", "Trichy"),
  STRUCT("coimbatore", "Coimbatore")
]) S
ON T.city_id = S.city_id
WHEN MATCHED THEN
  UPDATE SET city_name = S.city_name, active = TRUE, updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT (city_id, city_name, active, launch_date, updated_at)
  VALUES (S.city_id, S.city_name, TRUE, CURRENT_DATE("Asia/Kolkata"), CURRENT_TIMESTAMP());

MERGE `YOUR_PROJECT_ID.school_lunch.kitchens` T
USING UNNEST([
  STRUCT("chn-kitchen-01" AS kitchen_id, "chennai" AS city_id, "Chennai Central Kitchen" AS kitchen_name),
  STRUCT("md-kitchen-01", "madurai", "Madurai Central Kitchen"),
  STRUCT("try-kitchen-01", "trichy", "Trichy Central Kitchen"),
  STRUCT("cbe-kitchen-01", "coimbatore", "Coimbatore Central Kitchen")
]) S
ON T.kitchen_id = S.kitchen_id
WHEN MATCHED THEN
  UPDATE SET city_id = S.city_id, kitchen_name = S.kitchen_name, updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT (kitchen_id, city_id, kitchen_name, daily_capacity, order_cutoff, prep_lead_minutes, active, updated_at)
  VALUES (S.kitchen_id, S.city_id, S.kitchen_name, 500, TIME "09:00:00", 180, TRUE, CURRENT_TIMESTAMP());

MERGE `YOUR_PROJECT_ID.school_lunch.schools` T
USING UNNEST([
  STRUCT("chn-adyar-01" AS school_id, "chennai" AS city_id, "chn-kitchen-01" AS kitchen_id, "Adyar Pilot School" AS school_name, "Adyar" AS area),
  STRUCT("chn-annanagar-01", "chennai", "chn-kitchen-01", "Anna Nagar Pilot School", "Anna Nagar"),
  STRUCT("md-annanagar-01", "madurai", "md-kitchen-01", "Madurai Pilot School", "Anna Nagar"),
  STRUCT("md-kk-nagar-01", "madurai", "md-kitchen-01", "KK Nagar Pilot School", "KK Nagar"),
  STRUCT("try-cantonment-01", "trichy", "try-kitchen-01", "Trichy Pilot School", "Cantonment"),
  STRUCT("try-srirangam-01", "trichy", "try-kitchen-01", "Srirangam Pilot School", "Srirangam"),
  STRUCT("cbe-rspuram-01", "coimbatore", "cbe-kitchen-01", "RS Puram Pilot School", "RS Puram"),
  STRUCT("cbe-peelamedu-01", "coimbatore", "cbe-kitchen-01", "Peelamedu Pilot School", "Peelamedu")
]) S
ON T.school_id = S.school_id
WHEN MATCHED THEN
  UPDATE SET city_id = S.city_id, kitchen_id = S.kitchen_id, school_name = S.school_name, area = S.area, active = TRUE, updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT (school_id, city_id, kitchen_id, school_name, area, active, updated_at)
  VALUES (S.school_id, S.city_id, S.kitchen_id, S.school_name, S.area, TRUE, CURRENT_TIMESTAMP());

MERGE `YOUR_PROJECT_ID.school_lunch.delivery_routes` T
USING UNNEST([
  STRUCT("chn-route-01" AS route_id, "chn-kitchen-01" AS kitchen_id, "Chennai Pilot Route" AS route_name),
  STRUCT("md-route-01", "md-kitchen-01", "Madurai Pilot Route"),
  STRUCT("try-route-01", "try-kitchen-01", "Trichy Pilot Route"),
  STRUCT("cbe-route-01", "cbe-kitchen-01", "Coimbatore Pilot Route")
]) S
ON T.route_id = S.route_id
WHEN MATCHED THEN
  UPDATE SET kitchen_id = S.kitchen_id, route_name = S.route_name, active = TRUE, updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN
  INSERT (route_id, kitchen_id, route_name, driver_id, active, updated_at)
  VALUES (S.route_id, S.kitchen_id, S.route_name, NULL, TRUE, CURRENT_TIMESTAMP());

MERGE `YOUR_PROJECT_ID.school_lunch.menu_items` T
USING UNNEST([
  STRUCT("monday-balanced-meals" AS meal_id, DATE "2026-08-10" AS service_date, "Monday" AS day_label, "10 Aug" AS short_date, "Monday Balanced Meals" AS meal_name, "1 chapati, 1 bowl rice, sambar, curd, beans curry, carrot curry, channa and 1 appalam." AS description, 20 AS protein_g, 640 AS calories, NUMERIC "4.9" AS rating, "yellow" AS color),
  STRUCT("tuesday-balanced-meals", DATE "2026-08-11", "Tuesday", "11 Aug", "Tuesday Balanced Meals", "1 chapati, 1 bowl rice, sambar, curd, cabbage curry, beetroot curry, channa and 1 appalam.", 20, 640, NUMERIC "4.8", "green"),
  STRUCT("wednesday-balanced-meals", DATE "2026-08-12", "Wednesday", "12 Aug", "Wednesday Balanced Meals", "1 chapati, 1 bowl rice, sambar, curd, cauliflower curry, greens curry, channa and 1 appalam.", 21, 645, NUMERIC "4.9", "orange"),
  STRUCT("thursday-balanced-meals", DATE "2026-08-13", "Thursday", "13 Aug", "Thursday Balanced Meals", "1 chapati, 1 bowl rice, sambar, curd, potato-peas curry, pumpkin curry, channa and 1 appalam.", 20, 650, NUMERIC "4.7", "red"),
  STRUCT("friday-balanced-meals", DATE "2026-08-14", "Friday", "14 Aug", "Friday Balanced Meals", "1 chapati, 1 bowl rice, sambar, curd, okra curry, mixed-veg curry, channa and 1 appalam.", 21, 645, NUMERIC "4.8", "purple")
]) S
ON T.meal_id = S.meal_id AND T.service_date = S.service_date
WHEN MATCHED THEN UPDATE SET day_label=S.day_label, short_date=S.short_date, meal_name=S.meal_name, description=S.description, tags=["Vegetarian", "8 items"], protein_g=S.protein_g, calories=S.calories, price_inr=39, rating=S.rating, color=S.color, emoji="🍱", nutrition_status="provisional", is_available=TRUE, updated_at=CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (meal_id,service_date,day_label,short_date,meal_name,description,tags,protein_g,calories,price_inr,rating,color,emoji,nutrition_status,is_available,updated_at) VALUES (S.meal_id,S.service_date,S.day_label,S.short_date,S.meal_name,S.description,["Vegetarian", "8 items"],S.protein_g,S.calories,39,S.rating,S.color,"🍱","provisional",TRUE,CURRENT_TIMESTAMP());

MERGE `YOUR_PROJECT_ID.school_lunch.grade_nutrition_plans` T
USING UNNEST([
  STRUCT("6-8" AS grade_band, "6th–8th" AS label, 740 AS target_calories, 12 AS target_protein_g, 1 AS sort_order),
  STRUCT("9-10", "9th–10th", 870, 15, 2),
  STRUCT("11-12", "11th–12th", 1000, 18, 3)
]) S
ON T.grade_band = S.grade_band
WHEN MATCHED THEN UPDATE SET label=S.label, target_calories=S.target_calories, target_protein_g=S.target_protein_g, nutrition_status="provisional", sort_order=S.sort_order, active=TRUE, updated_at=CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (grade_band,label,target_calories,target_protein_g,nutrition_status,sort_order,active,updated_at) VALUES (S.grade_band,S.label,S.target_calories,S.target_protein_g,"provisional",S.sort_order,TRUE,CURRENT_TIMESTAMP());

UPDATE `YOUR_PROJECT_ID.school_lunch.schools`
SET price_tier = IF(school_id = "chn-adyar-01", "sponsored", "market"),
    updated_at = CURRENT_TIMESTAMP()
WHERE active;
