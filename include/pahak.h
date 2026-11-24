#ifndef PAHAK_H
#define PAHAK_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct PahakModel PahakModel;

typedef enum {
    PAHAK_OK = 0,
    PAHAK_INVALID_ARGUMENT,
    PAHAK_OUT_OF_MEMORY
} PahakStatus;

typedef struct {
    size_t tree_count;
    size_t sample_size;
    size_t max_depth;
    uint64_t seed;
} PahakConfig;

PahakConfig pahak_default_config(void);

PahakStatus pahak_model_train(
    const double *normal_samples,
    size_t sample_count,
    size_t feature_count,
    const PahakConfig *config,
    PahakModel **out_model);

PahakStatus pahak_model_score(
    const PahakModel *model,
    const double *features,
    size_t feature_count,
    double *out_score);

void pahak_model_free(PahakModel *model);

#ifdef __cplusplus
}
#endif

#endif
