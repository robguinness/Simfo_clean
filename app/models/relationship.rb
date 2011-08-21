class Relationship < ActiveRecord::Base
  belongs_to :from_entity, :class_name => 'Entity'
  belongs_to :relationship_type
  belongs_to :to_entity, :class_name => 'Entity'

  validates :from_entity, :presence => true
  validates :to_entity, :presence => true
  validates :relationship_type_id, :presence => true,
            :uniqueness => { :scope => [:from_entity_id, :to_entity_id] }
  validate :to_entity_must_be_a_category_if_relationship_type_categorizes
  validate :from_entity_must_be_a_category_if_relationship_type_categorizes_and_to_entity_is_super_category

  after_destroy :destroy_member_categorization_relationships_if_defines_category
  after_destroy :destroy_orphaned_associates

  # CSV output format, using gems Comma and FasterCSV
  comma do
    from_entity :name => 'From Entity'
    relationship_type :name => 'Relation'
    to_entity :name => 'To Entity'
    to_entity 'To Entity Plural (if Category)' do |entity| entity.category && entity.category.pluralized_name end
  end

  def categorizes?
    self.relationship_type.categorizes?
  end

  def defines_category?
    self.categorizes? && self.to_entity.category && self.to_entity.category.super_category?
  end

  def member_categorization_relationships
    if defines_category?
      Relationship.joins(:relationship_type).
                   where(:relationship_types => { :name => RelationshipType::Special::CategoryMembership },
                         :to_entity_id       => self.from_entity_id)
    else
      nil
    end
  end

  private

  def to_entity_must_be_a_category_if_relationship_type_categorizes
    errors.add(:to_entity, "is not a category") if
      relationship_type.categorizes? && !to_entity.category
  end

  def from_entity_must_be_a_category_if_relationship_type_categorizes_and_to_entity_is_super_category
    errors.add(:from_entity, "is not a category") if
      relationship_type.categorizes? && to_entity.category && to_entity.category.super_category? && !from_entity.category
  end

  def destroy_member_categorization_relationships_if_defines_category
    self.member_categorization_relationships.each { |mem_rel| mem_rel.destroy } if
      self.defines_category?
  end

  def destroy_orphaned_associates
    [from_entity, to_entity, relationship_type].each do |dependent|
      dependent.destroy if !dependent.nil? && dependent.orphaned?
    end
  end
end
