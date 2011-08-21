class AddSomeMoreIndexes < ActiveRecord::Migration
  def self.up
    add_index "relationships", "from_entity_id"
    add_index "relationships", "to_entity_id"
    add_index "relationships", "relationship_type_id"
  end

  def self.down
    remove_index "relationships", "from_entity_id"
    remove_index "relationships", "to_entity_id"
    remove_index "relationships", "relationship_type_id"
  end
end
