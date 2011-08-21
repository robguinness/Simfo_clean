require 'simfo_time_format_helper'

class RelationshipsController < ApplicationController
  include SimfoTimeFormatHelper
  respond_to :json, :xml
  respond_to :html, :only => [ :index, :upload ]
  respond_to :csv, :only => [ :index ]
  layout nil

  def index
    ordering = jqgridify_ordering(:default_table => Relationship.table_name) || 'from_entities.name ASC'
    @relationships = Relationship.order(ordering)
    @relationships = @relationships.
      joins('INNER JOIN entities AS from_entities ON from_entities.id = relationships.from_entity_id').includes(:from_entity).
      joins(:relationship_type).includes(:relationship_type).
      joins('INNER JOIN entities AS to_entities ON to_entities.id = relationships.to_entity_id').includes(:to_entity)
    @relationships = @relationships.where(jqgridify_searching)

    params[:per_page] ||= params[:rows]

    # Find the page of results containing the desired id
    if params[:must_show_id] && params[:per_page]
      desired = Relationship.find(params[:must_show_id])

      total_records = @relationships.count
      total_pages = total_records / params[:per_page].to_i

      logger.debug("  [*] Must show relationship id: '#{params[:must_show_id]}', total: #{total_records}, per_page: #{params[:per_page]}, pages: #{total_pages}")

      order_col = ordering.split(' ')[0].strip
      order_dir = ordering.split(' ')[1].strip.upcase
      order_cmp = (order_dir == 'ASC' ? '<' : '>')
      order_val = jggridify_get_column_reference_from_model(desired, order_col.gsub("#{Relationship.table_name}.", ''))

      desired_count_in_order = @relationships.where("#{order_col} #{order_cmp} ?", order_val).count
      desired_page = (desired_count_in_order / params[:per_page].to_i) + 1

      logger.debug("  [*] FOUND relationship id '#{params[:must_show_id]}' on page #{desired_page} / #{total_pages}")
      params[:page] = desired_page
    end

    @relationships = @relationships.page(params[:page] || 1).per(params[:per_page] || 25)

    if params[:jqgrid] # this is a query from jqgrid
      respond_with(jqgridify_relationships(@relationships, params[:page]))
    else
      respond_with(@relationships, :include => [:from_entity, :relationship_type, :to_entity])
    end
  end

  def show
    @relationship = Relationship.find(params[:id])
    respond_with(@relationship, :include => [:from_entity, :relationship_type, :to_entity])
  end

  def destroy
    @relationship = Relationship.find(params[:id])
    @relationship.destroy
    respond_with(@relationship)
  end

  def create
    create_or_update_relationship_from_names(params['relationship'])
    respond_with(@relationship)
  end

  def update
    @old_relationship = Relationship.find(params[:id])
    create_or_update_relationship_from_names(params['relationship'],
                                             :update_id => params[:id],
                                             :implicit_from_entity_category => params['relationship'].include?('from_entity__category__pluralized_name'))
    respond_with(@relationship)
  rescue ActiveRecord::RecordNotFound => ar_rnf
    render :json => { :id => 'record not found' }, :status => :not_found
  end

  def upload
    upload_headers = ['From Entity', 'Relation', 'To Entity']
    create_headers = %w(from_entity__name relationship_type__name to_entity__name to_entity__category__pluralized_name)
    line_num = 1
    response = {
      :error_line_nums => [],
      :duplicate_line_nums => [],
      :num_new_entities => 0,
      :num_new_relationships => 0,
    }
    param_csv = (params[:import_csv_form] ? params[:import_csv_form][:import_csv] : params[:import_csv])
    csv_io = (param_csv.respond_to?(:tempfile) ? param_csv.tempfile : param_csv)
    FasterCSV.parse(csv_io, { :headers => create_headers }) do |row|
      logger.debug("relationships#upload: Parsing csv ln #{line_num} '#{row.to_s.chomp}'")
      retried = false
      begin
        if row.values_at(0..2) != upload_headers
          create_or_update_relationship_from_names(row.to_hash, :implicit_from_entity_category => true)
          raise if @relationship.nil? || @relationship.id.nil?
          response[:num_new_entities] += @created.count { |obj| obj.is_a? Entity }
          response[:num_new_relationships] += @created.count { |obj| obj.is_a? Relationship }
        end
      rescue
        if @relationship && @relationship.errors && @relationship.errors[:to_entity] == ["is not a category"]
          create_relationship_categorizing_to_entity_from_names(row.to_hash)
          if !retried
            retried = true
            retry
          end
        elsif @relationship && @relationship.errors && @relationship.errors[:relationship_type_id] == ["has already been taken"]
          response[:duplicate_line_nums] << line_num
        else
          response[:error_line_nums] << line_num
        end
      ensure
        line_num += 1
        @created && @created.clear
      end
    end
  rescue Exception => e
    logger.error("relationships#upload: exception at csv line #{line_num} (#{e.inspect})")
    response[:error_line_nums] << line_num
  ensure
    render :json => response, :content_type => 'text/html'
  end

  protected

  def jqgridify_relationships(relationships, page)
    relationships =
      jqgridify(relationships, page,
                { :include => { :from_entity       => :name,
                                :relationship_type => :name,
                                :to_entity         => :name },
                  :cols => %w(from_entity_id       from_entity.name
                              relationship_type_id relationship_type.name
                              to_entity_id         to_entity.name
                              updated_at) })

    relationships['rows'].each { |row| row[:cell][6] = format_time_ago(row[:cell][6]) }

    return relationships
  end

  def create_or_update_relationship_from_names(re_params, options={})
    @created ||= []
    Relationship.transaction do
      begin
        @old_relationship && @old_relationship.destroy

        fe_scope = Entity.where(:name => re_params['from_entity__name'])
        @from_entity = fe_scope.first || @created.push(fe_scope.create!).last
        rt_scope = RelationshipType.where(:name => re_params['relationship_type__name'])
        @relationship_type = rt_scope.first || @created.push(rt_scope.create!).last

        te_scope = Entity.where(:name => re_params['to_entity__name'])
        @to_entity = te_scope.first || @created.push(te_scope.create!).last

        # create a category for From Entity if we are categorizing it as a Category
        if @relationship_type.categorizes? && @to_entity.category && @to_entity.category.super_category? && options[:implicit_from_entity_category]
          @from_entity.create_category unless @from_entity.category
          @from_entity.category.pluralized_name = re_params['from_entity__category__pluralized_name'] if
            re_params['from_entity__category__pluralized_name']
          @from_entity.category.save
        end

        reship_scope = Relationship.where(:from_entity_id       => @from_entity.id,
                                          :to_entity_id         => @to_entity.id,
                                          :relationship_type_id => @relationship_type.id,
                                          :id                   => options[:update_id])
        @relationship = reship_scope.create
        raise ActiveRecord::Rollback unless @relationship.save
        @created.push(@relationship) unless options[:update_id]
      rescue Exception => e
        logger.error("  [!] relations#create_or_update_relationship_from_names validation errors: " + @relationship.errors.to_json) if @relationship && !@relationship.valid?
        logger.error("  [!] relations#create_or_update_relationship_from_names error: " + e.inspect)
        # NOTE (2011-02-23, msiegel): Workaround for AR's lack of SQLite3 savepoint support
        # see https://rails.lighthouseapp.com/projects/8994-ruby-on-rails/tickets/6307
        @relationship && @relationship.destroy
        @old_relationship && @old_relationship.save
        @created.clear
        raise
      end
    end
  end

  def create_relationship_categorizing_to_entity_from_names(re_params)
    create_or_update_relationship_from_names({
      'from_entity__name' => re_params['to_entity__name'],
      'from_entity__category__pluralized_name' => re_params['to_entity__category__pluralized_name'],
      'relationship_type__name' => RelationshipType::Special::CategoryMembership,
      'to_entity__name' => Category::Special::SuperCategory.singularize
    }, :implicit_from_entity_category => true)
  end

end
