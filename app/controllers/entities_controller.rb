class EntitiesController < ApplicationController
  respond_to :json

  def index
    if params[:category_id]
      @category = Category.find(params[:category_id])
      @entities = @category.member_entities
    elsif params[:entitiesOptions] && params[:entitiesOptions][:includeNonCategories] == 'false'
      @entities = Entity.joins(:category).includes(:category)
    else
      @entities = Entity.includes(:category)
    end

    @entities = @entities.order('LOWER(entities.name)')

    if params[:_search] == 'true'
      jq_conds = jqgridify_searching
      jq_conds.first.gsub!(/(relationships|relationship_types)/, 'all_\\1')
      Rails.logger.debug('jq_conds: ' + jq_conds.inspect)
      @entities = @entities.
        joins('INNER JOIN relationships AS all_relationships ON (all_relationships.from_entity_id = entities.id OR all_relationships.to_entity_id = entities.id)').
        joins('INNER JOIN relationship_types AS all_relationship_types ON all_relationship_types.id = all_relationships.relationship_type_id').
        joins('INNER JOIN entities AS from_entities ON from_entities.id = all_relationships.from_entity_id').
        joins('INNER JOIN entities AS to_entities ON to_entities.id = all_relationships.to_entity_id').
        where(jq_conds).
        order(jqgridify_ordering || :name).
        group(jqgridify_grouping || :name)
    else
      @entities = @entities.order(:name)
    end

    # NOTE (2011-03-11, msiegel): Per Rob's request, stay on first page of results?
    params[:page] = 1
    @entities = @entities.page(params[:page]).per(params[:rows] || params[:per_page] || 25)

    respond_with(@entities, :include => :category)
  end
end
