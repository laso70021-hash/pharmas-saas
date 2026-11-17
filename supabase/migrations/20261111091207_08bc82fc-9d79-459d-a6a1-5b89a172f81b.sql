INSERT INTO public.profiles(id,email,full_name,phone)
SELECT id,coalesce(email,''),coalesce(raw_user_meta_data->>'full_name',raw_user_meta_data->>'name'),nullif(raw_user_meta_data->>'phone','') FROM auth.users WHERE id='25abb0d6-3fa5-48dd-85f0-4ebbaea48a27' ON CONFLICT(id) DO NOTHING;
INSERT INTO public.subscription_plans
(slug,name,price_tzs_monthly,price_tzs_annual,max_branches,max_employees,has_ai_insights,has_prescription_stt_ttt,has_advanced_ai_forecasting,has_bulk_import_ocr,has_delivery_management,support_tier,features,display_order,is_active)
VALUES
('starter','Essential',15000,165000,1,3,false,false,false,false,false,'email','["1 pharmacy","3 users","POS","Reports","Expenses management","Inventory management"]',1,true),
('growth','Retail Plus',29000,290000,1,4,true,true,false,false,false,'email','["1 pharmacy","1 store","4 users","POS","Reports","Expenses management","Inventory management including ordering, receiving, batch and expiry management"]',2,true),
('professional','Pharmacy Pro',49000,490000,3,12,true,true,true,true,true,'priority','["3 pharmacies","3 stores","Transfer of stock between branches","12 users","POS","Reports","Inventory management including ordering, receiving, expiry and batch management","Expenses management and financial reporting","Proforma invoices & wholesale client management"]',3,true),
('network','Pharmacy Network',99000,990000,6,18,true,true,true,true,true,'priority','["6 pharmacies","Store in each pharmacy","Transfer of stock between branches","18 users","POS","Reports","Inventory management including ordering, receiving, expiry and batch management","Expenses management and financial reporting","Proforma and wholesale clients management"]',4,true),
('enterprise','Enterprise Elite',0,0,999,999,true,true,true,true,true,'dedicated','["Unlimited pharmacies and branches","Unlimited users","Centralized inventory management","Inter-branch stock transfers","Advanced reporting and financial analytics","Advanced AI analytics and forecasting","Priority customer support","Dedicated account manager","Custom integrations","Custom onboarding"]',5,true)
ON CONFLICT(slug) DO UPDATE SET
name=excluded.name,price_tzs_monthly=excluded.price_tzs_monthly,price_tzs_annual=excluded.price_tzs_annual,
max_branches=excluded.max_branches,max_employees=excluded.max_employees,
has_ai_insights=excluded.has_ai_insights,has_prescription_stt_ttt=excluded.has_prescription_stt_ttt,
has_advanced_ai_forecasting=excluded.has_advanced_ai_forecasting,has_bulk_import_ocr=excluded.has_bulk_import_ocr,
has_delivery_management=excluded.has_delivery_management,support_tier=excluded.support_tier,
features=excluded.features,display_order=excluded.display_order,is_active=excluded.is_active;
UPDATE public.platform_settings SET value=jsonb_set(value,'{pharmacy_trial_days}','30') WHERE key='monetization';