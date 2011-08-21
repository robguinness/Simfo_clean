# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended to check this file into your version control system.

ActiveRecord::Schema.define(:version => 20110817064520) do

  create_table "categories", :force => true do |t|
    t.string   "pluralized_name"
    t.integer  "entity_id"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  add_index "categories", ["entity_id"], :name => "index_categories_on_entity_id", :unique => true

  create_table "entities", :force => true do |t|
    t.string   "name"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  add_index "entities", ["name"], :name => "index_entities_on_name", :unique => true

  create_table "microposts", :force => true do |t|
    t.string   "content"
    t.integer  "user_id"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  add_index "microposts", ["created_at"], :name => "index_microposts_on_created_at"
  add_index "microposts", ["user_id"], :name => "index_microposts_on_user_id"

  create_table "relationship_types", :force => true do |t|
    t.string   "name"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  add_index "relationship_types", ["name"], :name => "index_relationship_types_on_name", :unique => true

  create_table "relationships", :force => true do |t|
    t.integer  "from_entity_id"
    t.integer  "relationship_type_id"
    t.integer  "to_entity_id"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  add_index "relationships", ["from_entity_id", "relationship_type_id", "to_entity_id"], :name => "index_relationships_on_all_fields", :unique => true
  add_index "relationships", ["from_entity_id"], :name => "index_relationships_on_from_entity_id"
  add_index "relationships", ["relationship_type_id"], :name => "index_relationships_on_relationship_type_id"
  add_index "relationships", ["to_entity_id"], :name => "index_relationships_on_to_entity_id"
  add_index "relationships", ["updated_at"], :name => "index_relationships_on_updated_at"

  create_table "users", :force => true do |t|
    t.string   "name"
    t.string   "email"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string   "encrypted_password"
    t.string   "salt"
    t.boolean  "admin",              :default => false
  end

  add_index "users", ["email"], :name => "index_users_on_email", :unique => true

end
