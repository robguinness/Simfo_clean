class CreateRelationships < ActiveRecord::Migration
  def self.up
    create_table :relationships do |t|
      t.integer :from_entity_id
      t.integer :relationship_type_id
      t.integer :to_entity_id
      t.timestamps
    end

    add_index :relationships, [:from_entity_id, :relationship_type_id, :to_entity_id], :unique => true, :name => 'index_relationships_on_all_fields'
  end

  def self.down
    drop_table :relationships
  end
end
