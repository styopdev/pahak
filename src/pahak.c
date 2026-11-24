#include "pahak.h"

#include <math.h>
#include <stdlib.h>

#define PAHAK_MAX_TREE_DEPTH 64
#define PAHAK_DEFAULT_TREE_COUNT 100
#define PAHAK_DEFAULT_SAMPLE_SIZE 256
#define PAHAK_DEFAULT_SEED UINT64_C(0x9e3779b97f4a7c15)

typedef struct {
    size_t left;
    size_t right;
    size_t size;
    size_t feature;
    double split;
} PahakNode;

typedef struct {
    PahakNode *nodes;
    size_t node_count;
} PahakTree;

struct PahakModel {
    PahakTree *trees;
    size_t tree_count;
    size_t sample_size;
    size_t feature_count;
};

static uint64_t pahak_random_next(uint64_t *state)
{
    uint64_t value = *state;
    value ^= value >> 12;
    value ^= value << 25;
    value ^= value >> 27;
    *state = value;
    return value * UINT64_C(2685821657736338717);
}

static size_t pahak_random_bounded(uint64_t *state, size_t bound)
{
    return (size_t)(pahak_random_next(state) % (uint64_t)bound);
}

static double pahak_random_unit(uint64_t *state)
{
    return (double)(pahak_random_next(state) >> 11) / 9007199254740992.0;
}

static double pahak_expected_path_length(size_t sample_size)
{
    double count;
    double harmonic;

    if (sample_size <= 1) {
        return 0.0;
    }

    count = (double)(sample_size - 1);
    if (sample_size <= 64) {
        size_t i;
        harmonic = 0.0;
        for (i = 1; i <= sample_size - 1; ++i) {
            harmonic += 1.0 / (double)i;
        }
    } else {
        harmonic = log(count) + 0.5772156649015329 +
            1.0 / (2.0 * count) - 1.0 / (12.0 * count * count);
    }

    return 2.0 * harmonic - 2.0 * count / (double)sample_size;
}

static size_t pahak_build_node(
    PahakTree *tree,
    const double *samples,
    size_t feature_count,
    size_t *indices,
    size_t *scratch,
    size_t start,
    size_t count,
    size_t depth,
    size_t max_depth,
    uint64_t *random_state)
{
    size_t node_index = tree->node_count++;
    PahakNode *node = &tree->nodes[node_index];
    size_t feature;
    size_t eligible_count = 0;
    size_t chosen_feature = 0;
    double chosen_min = 0.0;
    double chosen_max = 0.0;
    size_t i;

    node->left = SIZE_MAX;
    node->right = SIZE_MAX;
    node->size = count;
    node->feature = 0;
    node->split = 0.0;

    if (count <= 1 || depth >= max_depth) {
        return node_index;
    }

    for (feature = 0; feature < feature_count; ++feature) {
        double minimum = samples[indices[start] * feature_count + feature];
        double maximum = minimum;
        size_t j;

        for (j = 1; j < count; ++j) {
            double value = samples[indices[start + j] * feature_count + feature];
            if (value < minimum) {
                minimum = value;
            }
            if (value > maximum) {
                maximum = value;
            }
        }

        if (minimum < maximum) {
            ++eligible_count;
            if (pahak_random_bounded(random_state, eligible_count) == 0) {
                chosen_feature = feature;
                chosen_min = minimum;
                chosen_max = maximum;
            }
        }
    }

    if (eligible_count == 0) {
        return node_index;
    }

    {
        double fraction = pahak_random_unit(random_state);
        double split = chosen_min * (1.0 - fraction) + chosen_max * fraction;
        size_t left_count = 0;
        size_t right_count;
        size_t left_child;
        size_t right_child;

        if (split < chosen_min || split >= chosen_max) {
            split = chosen_min;
        }

        for (i = 0; i < count; ++i) {
            size_t sample_index = indices[start + i];
            double value = samples[sample_index * feature_count + chosen_feature];
            if (value <= split) {
                scratch[start + left_count] = sample_index;
                ++left_count;
            } else {
                scratch[start + count - 1 - (i - left_count)] = sample_index;
            }
        }

        right_count = count - left_count;
        if (left_count == 0 || right_count == 0) {
            return node_index;
        }

        for (i = 0; i < count; ++i) {
            indices[start + i] = scratch[start + i];
        }

        node->feature = chosen_feature;
        node->split = split;
        left_child = pahak_build_node(
            tree, samples, feature_count, indices, scratch,
            start, left_count, depth + 1, max_depth, random_state);
        right_child = pahak_build_node(
            tree, samples, feature_count, indices, scratch,
            start + left_count, right_count, depth + 1, max_depth, random_state);

        tree->nodes[node_index].left = left_child;
        tree->nodes[node_index].right = right_child;
    }

    return node_index;
}

PahakConfig pahak_default_config(void)
{
    PahakConfig config;
    config.tree_count = PAHAK_DEFAULT_TREE_COUNT;
    config.sample_size = PAHAK_DEFAULT_SAMPLE_SIZE;
    config.max_depth = 0;
    config.seed = PAHAK_DEFAULT_SEED;
    return config;
}

void pahak_model_free(PahakModel *model)
{
    size_t i;

    if (model == NULL) {
        return;
    }

    if (model->trees != NULL) {
        for (i = 0; i < model->tree_count; ++i) {
            free(model->trees[i].nodes);
        }
    }
    free(model->trees);
    free(model);
}

PahakStatus pahak_model_train(
    const double *normal_samples,
    size_t sample_count,
    size_t feature_count,
    const PahakConfig *config,
    PahakModel **out_model)
{
    PahakConfig effective_config = config != NULL ? *config : pahak_default_config();
    PahakModel *model;
    size_t *indices;
    size_t *scratch;
    size_t effective_sample_size;
    size_t max_depth;
    size_t i;
    uint64_t random_state;

    if (out_model == NULL) {
        return PAHAK_INVALID_ARGUMENT;
    }
    *out_model = NULL;

    if (normal_samples == NULL || sample_count < 2 || feature_count == 0 ||
        sample_count > SIZE_MAX / feature_count ||
        sample_count > SIZE_MAX / sizeof(size_t) ||
        effective_config.tree_count > SIZE_MAX / sizeof(PahakTree)) {
        return PAHAK_INVALID_ARGUMENT;
    }

    for (i = 0; i < sample_count * feature_count; ++i) {
        if (!isfinite(normal_samples[i])) {
            return PAHAK_INVALID_ARGUMENT;
        }
    }

    if (effective_config.tree_count == 0) {
        effective_config.tree_count = PAHAK_DEFAULT_TREE_COUNT;
    }
    if (effective_config.sample_size == 0) {
        effective_config.sample_size = PAHAK_DEFAULT_SAMPLE_SIZE;
    }
    effective_sample_size = effective_config.sample_size < sample_count
        ? effective_config.sample_size
        : sample_count;
    if (effective_sample_size < 2 ||
        effective_sample_size > SIZE_MAX / 2 / sizeof(PahakNode)) {
        return PAHAK_INVALID_ARGUMENT;
    }

    max_depth = effective_config.max_depth;
    if (max_depth == 0) {
        size_t capacity = 1;
        while (capacity < effective_sample_size) {
            if (capacity > SIZE_MAX / 2) {
                return PAHAK_INVALID_ARGUMENT;
            }
            capacity *= 2;
            ++max_depth;
        }
    }
    if (max_depth > PAHAK_MAX_TREE_DEPTH) {
        return PAHAK_INVALID_ARGUMENT;
    }

    model = (PahakModel *)calloc(1, sizeof(*model));
    if (model == NULL) {
        return PAHAK_OUT_OF_MEMORY;
    }
    model->tree_count = effective_config.tree_count;
    model->sample_size = effective_sample_size;
    model->feature_count = feature_count;
    model->trees = (PahakTree *)calloc(model->tree_count, sizeof(*model->trees));
    indices = (size_t *)malloc(sample_count * sizeof(*indices));
    scratch = (size_t *)malloc(sample_count * sizeof(*scratch));
    if (model->trees == NULL || indices == NULL || scratch == NULL) {
        free(indices);
        free(scratch);
        pahak_model_free(model);
        return PAHAK_OUT_OF_MEMORY;
    }

    random_state = effective_config.seed != 0
        ? effective_config.seed
        : PAHAK_DEFAULT_SEED;

    for (i = 0; i < model->tree_count; ++i) {
        size_t j;
        size_t node_capacity = effective_sample_size * 2;
        PahakTree *tree = &model->trees[i];

        tree->nodes = (PahakNode *)malloc(node_capacity * sizeof(*tree->nodes));
        if (tree->nodes == NULL) {
            free(indices);
            free(scratch);
            pahak_model_free(model);
            return PAHAK_OUT_OF_MEMORY;
        }

        for (j = 0; j < sample_count; ++j) {
            indices[j] = j;
        }
        for (j = 0; j < effective_sample_size; ++j) {
            size_t selected = j + pahak_random_bounded(&random_state, sample_count - j);
            size_t temporary = indices[j];
            indices[j] = indices[selected];
            indices[selected] = temporary;
        }

        pahak_build_node(
            tree, normal_samples, feature_count, indices, scratch,
            0, effective_sample_size, 0, max_depth, &random_state);
    }

    free(indices);
    free(scratch);
    *out_model = model;
    return PAHAK_OK;
}

PahakStatus pahak_model_score(
    const PahakModel *model,
    const double *features,
    size_t feature_count,
    double *out_score)
{
    double total_path_length = 0.0;
    size_t tree_index;

    if (model == NULL || features == NULL || out_score == NULL ||
        feature_count != model->feature_count) {
        return PAHAK_INVALID_ARGUMENT;
    }
    for (tree_index = 0; tree_index < feature_count; ++tree_index) {
        if (!isfinite(features[tree_index])) {
            return PAHAK_INVALID_ARGUMENT;
        }
    }

    for (tree_index = 0; tree_index < model->tree_count; ++tree_index) {
        const PahakTree *tree = &model->trees[tree_index];
        size_t node_index = 0;
        size_t depth = 0;

        while (tree->nodes[node_index].left != SIZE_MAX) {
            const PahakNode *node = &tree->nodes[node_index];
            node_index = features[node->feature] <= node->split
                ? node->left
                : node->right;
            ++depth;
        }
        total_path_length += (double)depth +
            pahak_expected_path_length(tree->nodes[node_index].size);
    }

    if (model->sample_size <= 1) {
        *out_score = 0.5;
    } else {
        double average_path = total_path_length / (double)model->tree_count;
        *out_score = pow(2.0, -average_path /
            pahak_expected_path_length(model->sample_size));
    }

    return PAHAK_OK;
}
