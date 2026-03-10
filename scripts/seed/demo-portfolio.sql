-- Comprehensive demo portfolio seed for local testing
-- Covers assets, outgoing cashflow, income cashflow, linked/unlinked rows,
-- completed/pending/overdue events, soft-delete visibility, and activity logs.

BEGIN;

-- Demo user
INSERT INTO "Users" (id, username, username_normalized, email, email_normalized, password_hash, created_at, updated_at)
VALUES (
  '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
  'bryan',
  'bryan',
  'bryan@local.dev',
  'bryan@local.dev',
  'local-dev',
  NOW() - INTERVAL '800 days',
  NOW()
)
ON CONFLICT (username_normalized)
DO UPDATE SET
  username = EXCLUDED.username,
  email = EXCLUDED.email,
  email_normalized = EXCLUDED.email_normalized,
  updated_at = NOW();

-- Reset only this user's demo domain data
DELETE FROM "AuditLog" WHERE user_id = '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef';
DELETE FROM "Items" WHERE user_id = '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef';

-- Items
INSERT INTO "Items" (id, user_id, item_type, attributes, parent_item_id, created_at, updated_at)
VALUES
  -- Assets: properties and vehicles
  (
    '41000000-0000-4000-8000-000000000001',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'RealEstate',
    '{"address":"18 Yorkville Ave, Toronto, ON","city":"Toronto","province":"ON","postalCode":"M4W1L5","estimatedValue":1450000,"monthlyRent":4200,"occupancy":"Tenant","tenantName":"L. Chen","leaseEnd":"2027-08-31","description":"Downtown condo with premium long-term tenant."}'::jsonb,
    NULL,
    NOW() - INTERVAL '620 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    '41000000-0000-4000-8000-000000000002',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'RealEstate',
    '{"address":"72 Whytewold Rd, Winnipeg, MB","city":"Winnipeg","province":"MB","postalCode":"R3J2V3","estimatedValue":610000,"monthlyRent":2400,"occupancy":"Tenant","tenantName":"M. Sorenson","leaseEnd":"2026-12-31","description":"Duplex rental with one recently renewed unit."}'::jsonb,
    NULL,
    NOW() - INTERVAL '520 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    '41000000-0000-4000-8000-000000000003',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'RealEstate',
    '{"address":"44 Lakeshore Rd W, Oakville, ON","city":"Oakville","province":"ON","postalCode":"L6K1E6","estimatedValue":1890000,"monthlyRent":5100,"occupancy":"Tenant","tenantName":"A. Parker","leaseEnd":"2027-03-31","description":"Detached executive rental near the waterfront."}'::jsonb,
    NULL,
    NOW() - INTERVAL '460 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '41000000-0000-4000-8000-000000000004',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'Vehicle',
    '{"year":2021,"make":"Honda","model":"CR-V Touring","vin":"2HKRW2H89MH123456","estimatedValue":36500,"description":"Primary family SUV for city driving and property visits.","plate":"ON BRYN-21"}'::jsonb,
    NULL,
    NOW() - INTERVAL '800 days',
    NOW() - INTERVAL '8 days'
  ),
  (
    '41000000-0000-4000-8000-000000000005',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'Vehicle',
    '{"year":2019,"make":"Mercedes-Benz","model":"E300","vin":"WDDZF4KB7KA765432","estimatedValue":41500,"description":"Secondary vehicle used for client meetings and occasional short-term rental.","plate":"ON BRYN-19"}'::jsonb,
    NULL,
    NOW() - INTERVAL '1100 days',
    NOW() - INTERVAL '7 days'
  ),
  (
    '41000000-0000-4000-8000-000000000006',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'Vehicle',
    '{"year":2022,"make":"Ford","model":"Transit","vin":"1FTBR1C87NKA54321","estimatedValue":48900,"description":"Utility van used for maintenance logistics.","plate":"ON HACT-22"}'::jsonb,
    NULL,
    NOW() - INTERVAL '500 days',
    NOW() - INTERVAL '6 days'
  ),

  -- Outgoing cashflow (FinancialCommitment)
  (
    '42000000-0000-4000-8000-000000000001',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialCommitment',
    '{"name":"Mortgage - 18 Yorkville Ave","lender":"RBC","amount":3980,"dueDate":"2026-03-01","interestRate":5.24,"originalPrincipal":940000,"remainingBalance":792000,"nextPaymentAmount":3980,"description":"Primary mortgage tied to the Toronto condo.","accountNumber":"RBC-MTG-7741"}'::jsonb,
    '41000000-0000-4000-8000-000000000001',
    NOW() - INTERVAL '600 days',
    NOW() - INTERVAL '1 days'
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialCommitment',
    '{"name":"Mortgage - 72 Whytewold Rd","lender":"TD","amount":1860,"dueDate":"2026-03-05","interestRate":4.89,"originalPrincipal":365000,"remainingBalance":302000,"nextPaymentAmount":1860,"description":"Mortgage for Winnipeg duplex.","accountNumber":"TD-MTG-2219"}'::jsonb,
    '41000000-0000-4000-8000-000000000002',
    NOW() - INTERVAL '500 days',
    NOW() - INTERVAL '1 days'
  ),
  (
    '42000000-0000-4000-8000-000000000003',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialCommitment',
    '{"name":"Mortgage - 44 Lakeshore Rd W","lender":"Scotiabank","amount":4525,"dueDate":"2026-03-03","interestRate":5.09,"originalPrincipal":1125000,"remainingBalance":965000,"nextPaymentAmount":4525,"description":"Mortgage for Oakville detached home.","accountNumber":"SCOT-MTG-8400"}'::jsonb,
    '41000000-0000-4000-8000-000000000003',
    NOW() - INTERVAL '450 days',
    NOW() - INTERVAL '1 days'
  ),
  (
    '42000000-0000-4000-8000-000000000004',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialCommitment',
    '{"name":"Condo Fees - 18 Yorkville Ave","amount":845,"dueDate":"2026-03-06","billingCycle":"Monthly","nextPaymentAmount":845,"description":"Monthly condo maintenance fee."}'::jsonb,
    '41000000-0000-4000-8000-000000000001',
    NOW() - INTERVAL '300 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '42000000-0000-4000-8000-000000000005',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialCommitment',
    '{"name":"Insurance - 44 Lakeshore Rd W","amount":310,"dueDate":"2026-03-09","billingCycle":"Monthly","nextPaymentAmount":310,"description":"Landlord insurance for Oakville property."}'::jsonb,
    '41000000-0000-4000-8000-000000000003',
    NOW() - INTERVAL '280 days',
    NOW() - INTERVAL '4 days'
  ),
  (
    '42000000-0000-4000-8000-000000000006',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialCommitment',
    '{"name":"Insurance - 2019 Mercedes-Benz E300","amount":205,"dueDate":"2026-03-14","billingCycle":"Monthly","nextPaymentAmount":205,"description":"Auto insurance for Mercedes."}'::jsonb,
    '41000000-0000-4000-8000-000000000005',
    NOW() - INTERVAL '260 days',
    NOW() - INTERVAL '4 days'
  ),
  (
    '42000000-0000-4000-8000-000000000007',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialCommitment',
    '{"name":"Auto Loan - 2021 Honda CR-V Touring","lender":"Honda Finance","amount":640,"dueDate":"2026-03-18","interestRate":3.75,"originalPrincipal":42000,"remainingBalance":18400,"nextPaymentAmount":640,"description":"Vehicle financing for CR-V."}'::jsonb,
    '41000000-0000-4000-8000-000000000004',
    NOW() - INTERVAL '780 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    '42000000-0000-4000-8000-000000000008',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialCommitment',
    '{"name":"Insurance - 2022 Ford Transit","amount":230,"dueDate":"2026-03-11","billingCycle":"Monthly","nextPaymentAmount":230,"description":"Commercial auto insurance for maintenance van."}'::jsonb,
    '41000000-0000-4000-8000-000000000006',
    NOW() - INTERVAL '200 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '42000000-0000-4000-8000-000000000009',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialCommitment',
    '{"name":"Personal Line of Credit","lender":"CIBC","amount":320,"dueDate":"2026-03-20","interestRate":8.4,"originalPrincipal":25000,"remainingBalance":9300,"nextPaymentAmount":320,"description":"Standalone personal line of credit.","purpose":"Cashflow smoothing"}'::jsonb,
    NULL,
    NOW() - INTERVAL '420 days',
    NOW() - INTERVAL '4 days'
  ),
  (
    '42000000-0000-4000-8000-000000000010',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialCommitment',
    '{"name":"Family Mobile Plan","amount":165,"dueDate":"2026-03-16","billingCycle":"Monthly","nextPaymentAmount":165,"description":"Standalone household communications bill."}'::jsonb,
    NULL,
    NOW() - INTERVAL '360 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    '42000000-0000-4000-8000-000000000011',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialCommitment',
    '{"name":"Gym Membership (Paused)","amount":59,"dueDate":"2026-03-25","billingCycle":"Monthly","description":"Soft-deleted sample row for deleted filter testing.","_deleted_at":"2026-02-10T11:30:00.000Z","_deleted_by":"9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef"}'::jsonb,
    NULL,
    NOW() - INTERVAL '250 days',
    NOW() - INTERVAL '15 days'
  ),

  -- Incoming cashflow (FinancialIncome)
  (
    '43000000-0000-4000-8000-000000000001',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialIncome',
    '{"name":"Rent Collection - 18 Yorkville Ave","amount":4200,"dueDate":"2026-03-01","billingCycle":"Monthly","collectedTotal":26400,"description":"Monthly rent from Yorkville condo.","payer":"L. Chen"}'::jsonb,
    '41000000-0000-4000-8000-000000000001',
    NOW() - INTERVAL '220 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '43000000-0000-4000-8000-000000000002',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialIncome',
    '{"name":"Rent Collection - 72 Whytewold Rd","amount":2400,"dueDate":"2026-03-02","billingCycle":"Monthly","collectedTotal":16800,"description":"Monthly rent from Winnipeg duplex.","payer":"M. Sorenson"}'::jsonb,
    '41000000-0000-4000-8000-000000000002',
    NOW() - INTERVAL '210 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '43000000-0000-4000-8000-000000000003',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialIncome',
    '{"name":"Rent Collection - 44 Lakeshore Rd W","amount":5100,"dueDate":"2026-03-03","billingCycle":"Monthly","collectedTotal":30600,"description":"Monthly rent from Oakville detached home.","payer":"A. Parker"}'::jsonb,
    '41000000-0000-4000-8000-000000000003',
    NOW() - INTERVAL '230 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '43000000-0000-4000-8000-000000000004',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialIncome',
    '{"name":"Short-Term Rental Income - 2019 Mercedes-Benz E300","amount":780,"dueDate":"2026-03-08","billingCycle":"Monthly","collectedTotal":4680,"description":"Net income from occasional weekend rentals."}'::jsonb,
    '41000000-0000-4000-8000-000000000005',
    NOW() - INTERVAL '170 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '43000000-0000-4000-8000-000000000005',
    '9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef',
    'FinancialIncome',
    '{"name":"Consulting Retainer","amount":2500,"dueDate":"2026-03-10","billingCycle":"Monthly","collectedTotal":15000,"description":"Standalone recurring consulting income.","client":"Northline Advisory"}'::jsonb,
    NULL,
    NOW() - INTERVAL '300 days',
    NOW() - INTERVAL '6 days'
  );

-- Events (mix of pending, overdue, completed, recurring/non-recurring)
INSERT INTO "Events" (id, item_id, event_type, due_date, amount, status, is_recurring, completed_at, created_at, updated_at)
VALUES
  -- Outgoing commitments
  ('51000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','Mortgage Payment',NOW() + INTERVAL '4 days',3980.00,'Pending',true,NULL,NOW() - INTERVAL '25 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000001','Mortgage Payment',NOW() - INTERVAL '26 days',3980.00,'Completed',true,NOW() - INTERVAL '25 days',NOW() - INTERVAL '58 days',NOW() - INTERVAL '25 days'),
  ('51000000-0000-4000-8000-000000000003','42000000-0000-4000-8000-000000000002','Mortgage Payment',NOW() + INTERVAL '8 days',1860.00,'Pending',true,NULL,NOW() - INTERVAL '24 days',NOW() - INTERVAL '2 days'),
  ('51000000-0000-4000-8000-000000000004','42000000-0000-4000-8000-000000000003','Mortgage Payment',NOW() + INTERVAL '6 days',4525.00,'Pending',true,NULL,NOW() - INTERVAL '24 days',NOW() - INTERVAL '2 days'),
  ('51000000-0000-4000-8000-000000000005','42000000-0000-4000-8000-000000000004','Condo Fee',NOW() + INTERVAL '9 days',845.00,'Pending',true,NULL,NOW() - INTERVAL '19 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000006','42000000-0000-4000-8000-000000000005','Insurance Premium',NOW() + INTERVAL '13 days',310.00,'Pending',true,NULL,NOW() - INTERVAL '18 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000007','42000000-0000-4000-8000-000000000006','Insurance Premium',NOW() + INTERVAL '14 days',205.00,'Pending',true,NULL,NOW() - INTERVAL '18 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000008','42000000-0000-4000-8000-000000000007','Auto Loan Payment',NOW() + INTERVAL '17 days',640.00,'Pending',true,NULL,NOW() - INTERVAL '20 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000009','42000000-0000-4000-8000-000000000008','Commercial Auto Insurance',NOW() + INTERVAL '12 days',230.00,'Pending',true,NULL,NOW() - INTERVAL '20 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000010','42000000-0000-4000-8000-000000000009','Line of Credit Payment',NOW() + INTERVAL '19 days',320.00,'Pending',true,NULL,NOW() - INTERVAL '20 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000011','42000000-0000-4000-8000-000000000010','Mobile Plan Charge',NOW() + INTERVAL '15 days',165.00,'Pending',true,NULL,NOW() - INTERVAL '18 days',NOW() - INTERVAL '1 day'),

  -- Income events
  ('51000000-0000-4000-8000-000000000012','43000000-0000-4000-8000-000000000001','Rent Collection',NOW() + INTERVAL '3 days',4200.00,'Pending',true,NULL,NOW() - INTERVAL '10 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000013','43000000-0000-4000-8000-000000000002','Rent Collection',NOW() + INTERVAL '4 days',2400.00,'Pending',true,NULL,NOW() - INTERVAL '10 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000014','43000000-0000-4000-8000-000000000003','Rent Collection',NOW() + INTERVAL '5 days',5100.00,'Pending',true,NULL,NOW() - INTERVAL '10 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000015','43000000-0000-4000-8000-000000000004','Short-Term Rental Payout',NOW() + INTERVAL '11 days',780.00,'Pending',true,NULL,NOW() - INTERVAL '10 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000016','43000000-0000-4000-8000-000000000005','Consulting Retainer Deposit',NOW() + INTERVAL '7 days',2500.00,'Pending',true,NULL,NOW() - INTERVAL '10 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000017','43000000-0000-4000-8000-000000000001','Rent Collection',NOW() - INTERVAL '27 days',4200.00,'Completed',true,NOW() - INTERVAL '26 days',NOW() - INTERVAL '58 days',NOW() - INTERVAL '26 days'),

  -- Asset-level operational events
  ('51000000-0000-4000-8000-000000000018','41000000-0000-4000-8000-000000000001','Property Tax Installment',NOW() + INTERVAL '30 days',1600.00,'Pending',false,NULL,NOW() - INTERVAL '14 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000019','41000000-0000-4000-8000-000000000002','Property Tax Installment',NOW() + INTERVAL '36 days',980.00,'Pending',false,NULL,NOW() - INTERVAL '12 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000020','41000000-0000-4000-8000-000000000003','Property Tax Installment',NOW() + INTERVAL '33 days',2100.00,'Pending',false,NULL,NOW() - INTERVAL '12 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000021','41000000-0000-4000-8000-000000000001','Boiler Maintenance',NOW() + INTERVAL '10 days',450.00,'Pending',false,NULL,NOW() - INTERVAL '9 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000022','41000000-0000-4000-8000-000000000003','HVAC Inspection',NOW() - INTERVAL '3 days',520.00,'Pending',false,NULL,NOW() - INTERVAL '7 days',NOW() - INTERVAL '1 day'),
  ('51000000-0000-4000-8000-000000000023','41000000-0000-4000-8000-000000000004','Oil Change Service',NOW() - INTERVAL '12 days',130.00,'Completed',false,NOW() - INTERVAL '11 days',NOW() - INTERVAL '40 days',NOW() - INTERVAL '11 days'),
  ('51000000-0000-4000-8000-000000000024','41000000-0000-4000-8000-000000000005','Vehicle Registration Renewal',NOW() + INTERVAL '52 days',180.00,'Pending',false,NULL,NOW() - INTERVAL '6 days',NOW() - INTERVAL '1 day');

-- Activity logs for timeline coverage
INSERT INTO "AuditLog" (id, user_id, action, entity, timestamp, created_at, updated_at)
VALUES
  ('61000000-0000-4000-8000-000000000001','9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef','item.created','item:41000000-0000-4000-8000-000000000001',NOW() - INTERVAL '620 days',NOW() - INTERVAL '620 days',NOW() - INTERVAL '620 days'),
  ('61000000-0000-4000-8000-000000000002','9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef','item.created','item:42000000-0000-4000-8000-000000000001',NOW() - INTERVAL '600 days',NOW() - INTERVAL '600 days',NOW() - INTERVAL '600 days'),
  ('61000000-0000-4000-8000-000000000003','9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef','item.updated','item:42000000-0000-4000-8000-000000000001',NOW() - INTERVAL '2 days',NOW() - INTERVAL '2 days',NOW() - INTERVAL '2 days'),
  ('61000000-0000-4000-8000-000000000004','9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef','item.created','item:43000000-0000-4000-8000-000000000001',NOW() - INTERVAL '220 days',NOW() - INTERVAL '220 days',NOW() - INTERVAL '220 days'),
  ('61000000-0000-4000-8000-000000000005','9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef','event.completed','event:51000000-0000-4000-8000-000000000002',NOW() - INTERVAL '25 days',NOW() - INTERVAL '25 days',NOW() - INTERVAL '25 days'),
  ('61000000-0000-4000-8000-000000000006','9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef','event.completed','event:51000000-0000-4000-8000-000000000017',NOW() - INTERVAL '26 days',NOW() - INTERVAL '26 days',NOW() - INTERVAL '26 days'),
  ('61000000-0000-4000-8000-000000000007','9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef','event.completed','event:51000000-0000-4000-8000-000000000023',NOW() - INTERVAL '11 days',NOW() - INTERVAL '11 days',NOW() - INTERVAL '11 days'),
  ('61000000-0000-4000-8000-000000000008','9f8c7e6d-5b4a-4f3e-9d2c-1a0b1234cdef','item.updated','item:43000000-0000-4000-8000-000000000001',NOW() - INTERVAL '26 days',NOW() - INTERVAL '26 days',NOW() - INTERVAL '26 days');

COMMIT;
