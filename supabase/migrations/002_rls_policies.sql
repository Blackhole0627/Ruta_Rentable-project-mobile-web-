ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_data" ON users FOR ALL USING (id = auth.uid());
CREATE POLICY "own_vehicles" ON user_vehicles FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_trips" ON trips FOR ALL USING (user_id = auth.uid());
CREATE POLICY "catalog_public" ON vehicle_catalog FOR SELECT USING (true);
