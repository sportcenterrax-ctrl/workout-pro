create table users (id bigint generated always as identity primary key, username text unique not null, password text not null, role text default 'client', name text not null);
create table programs (id bigint generated always as identity primary key, trainer text, program_date date, client text, group_name text, exercise text, load_val text, rep text, set_count text, rest text, link text, comment text, hidden boolean default false, status text default 'Active');
create table history_logs (id bigint generated always as identity primary key, logged_at timestamptz default now(), client_name text, program_group text, exercise text, actual_load text, rating text, note text);
create table client_status (id bigint generated always as identity primary key, username text, goal_type text, target_value text, current_status text, trainer_note text, updated_at timestamptz default now(), trainer_name text);
create table body_metrics (id bigint generated always as identity primary key, test_date date, username text, weight numeric, fat_percent numeric, water_percent numeric, muscle_mass numeric, bmr numeric, metabolic_age numeric, bone_mass numeric, visceral_fat numeric);

-- เปิดความปลอดภัย: ไม่มี policy = คนนอกเข้าตรงๆ ไม่ได้ (มีแต่ Netlify Function ที่ใช้ service key เข้าได้)
alter table users enable row level security;
alter table programs enable row level security;
alter table history_logs enable row level security;
alter table client_status enable row level security;
alter table body_metrics enable row level security;

-- ผู้ใช้ทดสอบ (เปลี่ยนรหัสภายหลัง)
insert into users (username, password, role, name) values
 ('trainer1','1234','trainer','เทรนเนอร์ทดสอบ'),
 ('client1','1234','client','ลูกค้าทดสอบ');
