class CreateRelationshipTypes < ActiveRecord::Migration
  def self.up
    create_table :relationship_types do |t|
      t.string :name      
      t.timestamps
    end
    
    add_index :relationship_types, :name, :unique => true
  end

  def self.down
    drop_table :relationship_types
  end
end
