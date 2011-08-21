class Category < ActiveRecord::Base
  belongs_to :entity

  before_validation :default_pluralized_name_if_missing

  validates :entity_id, :presence => true, :uniqueness => true
  validates :pluralized_name, :presence => true, :uniqueness => true

  module Special
    SuperCategory = 'Categories'
  end

  def super_category?
    self.pluralized_name == Special::SuperCategory
  end

  def member_entities
    Entity.joins(:from_relationships => :relationship_type).
           where(:relationship_types => { :name => RelationshipType::Special::CategoryMembership },
                 :relationships      => { :to_entity_id => self.entity_id })
  end

  def default_pluralized_name_if_missing
    self.pluralized_name = self.entity.name.pluralize if pluralized_name.blank? && entity
  end
end
