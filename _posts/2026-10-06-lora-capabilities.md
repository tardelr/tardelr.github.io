---
title: "LoRA capabilities post"
description: Creating LoRA adapter new output formats and new facts with evaluation comparison.
date: 2026-10-06
github: https://github.com/tardelr/lora-technical-post
huggingface: https://huggingface.co/datasets/tardelr/worldcup2026
---

The goal of this post is to highlight the **capabilities** of a LoRA adapter, creating a Layout formatting and Knowledge incorporation adapters.

<!--more-->

## Introduction

The motivation of this post is that LoRA does a great job adapting open-source models and a lot of people could benefit from it. But, in my opinion, it lacks easy-to-digest resources explaining _what_ you can do with it.

We'll build LoRA adapters for 2 different use-cases:
1. Answer format (adjusting the model to answer always a JSON or Alpaca valid response)
2. Specific knowledge

Without a technique like LoRA fine-tuning models would be a prohibitively expensive task for independent researchers and most companies. For example, Llama 4 Scout fits on a single H100 for inference, but full fine-tuning in 16-bit precision would require roughly 30× more VRAM. With LoRA (QLoRA in this case), it's possible to fine-tune and experiment on it.

**tl;dr**, We successfully trained LoRA adapters for Qwen 0.6B and achieved 100% JSON layout accuracy, without degrading model performance. Also showed a successful example adding knowledge through LoRA adapter.

## What is LoRA

LoRA (low-rank adaptation) [[1]](#ref-1) is a method to fine-tune large language models. It was created to efficiently make small adaptations in a large model. With a low percentage of parameters (in some cases < 0.1 %) you can make meaningful changes in LLMs' responses.

There's a great video where Edward Hu (the creator himself) introduces LoRA, and gives a brief historical and methodological introduction (highly recommend) [[2]](#ref-2).

## How LoRA works

### Intuition

LoRA appends weights to selected linear transformations and weights matrices. The LoRA weights are kept separate in smaller matrices A and B, such that W_lora = BA, where the A and B matrices have lower rank than the original weights and W_lora has the same shape as W_model.

Although W_lora has the same shape as the weight matrix it adapts, we don't learn each of its entries individually; we only learn A and B, and let the optimizer find the values that minimize the loss.

Visually, it'd look like this:

![LoRA update in four steps: frozen 4×3 weights W; rank-1 adapters B (4×1) and A (1×3) with 7 trainable parameters; their product BA is 4×3; W′ = W + (α/r)·BA has the same shape as W](/assets/img/lora_w_matrix_update.png)

In practice, we'd have a W_lora matrix for each linear transformation of our choice (including all).

The classic LoRA diagram, from the original paper:

![LoRA reparametrization from the original paper: input x goes through the frozen pretrained weights W ∈ ℝ^(d×d) and, in parallel, through A = 𝒩(0, σ²) down to rank r and B = 0 back up; the two outputs are summed into h](/assets/img/lora_adapter_image.png)

It shows how this parallel operation is carried out, and also how A and B are initialized. A is initialized to a random Gaussian, and B to a zeros matrix, so in the beginning, BA results in zero and has no impact in predictions.

## How to train a LoRA adapter

For these experiments, we'll use the `Qwen3-0.6B` [[3]](#ref-3), but the same procedure should work for any model.

The procedure is very similar to a normal fine-tuning, the difference is that we freeze the base model weights and only A, B matrices get gradient updates.

1. Load the base model
2. Create the adapter with a `LoraConfig`, choose the rank, the scaling, and which layers get adapters
3. Wrap the model with the adapter
4. Run the training

```python
lora_config = LoraConfig(
r=8,
lora_alpha=16, 
target_modules="all-linear"
)
```

The `lora_config` is then passed to `SFTTrainer` in the parameter `peft_config=lora_config`:

```python
trainer = SFTTrainer(
    model=model,
    args=sft_config,
    train_dataset=dataset,
    processing_class=tokenizer,
    peft_config=lora_config, # -> this is what turns it into a LoRA run
)

trainer.train()
trainer.save_model("my-adapter")  # saves only the adapter weights
```

This post will not cover each parameter you can tune while training, for that I recommend going through the documentation and original paper [[1]](#ref-1).

The two main parameters are:

- **r:** the rank of the adapter matrices. The LoRA weights will have dimensions d_out × r (B) and r × d_in (A).
- **lora_alpha:** scaling factor. The adapter's output is multiplied by lora_alpha / r; it controls the LoRA contribution to the result. A common rule of thumb is lora_alpha = 2 × r.

## What can you do with LoRA

There's no definitive answer of "what" you can do, just as there's no answer of what you can fine-tune a model to do. But certainly there are some common applications.

It's important to note that LoRA can harm original model performance, and a reasonable rule of thumb is: the more you want to change the behavior, the more you'll hurt the performance.

Also, there's evidence that LoRA fine-tuning can degrade model's Safety performance [[4]](#ref-4), [[5]](#ref-5). I'll cover it briefly in the Safety evaluation topic, and (in future) write a post about it.

I don't go in details in the post on _how_ to train these models, because the GitHub and Hugging Face repos have all the necessary code and data.

Here I'll introduce the tasks, bring a couple of examples, but the results are presented and discussed in the Evaluation section.

### Adjust to get a specific answer format

This is a very cost-efficient way to adjust a model's answer. Below, I'll give a few examples; the cost comparison with FFT comes later, in the Cost comparison section.

I'll cover two popular applications:

1. Alpaca format
2. JSON

#### Alpaca format

The simplest explanation is that Alpaca is a prompt template introduced by Taori et al. (2023) [[6]](#ref-6) for instruction-following models and it's widely used.

In practice, it consists in formatting the prompt so it looks like this:

```text
Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction: [Instructions to the task]

### Response: [Answer]
```

In this example, the goal is to have the model responding in the alpaca template. We'll apply the alpaca template to each entry in the dataset (`Commonsense170k` [[7]](#ref-7)).

The base model would respond in a continuous way, as we are used to, but for some applications (like evaluations) it is helpful to have the model adjusted to respond in the Alpaca format.

The magic is done by repeatedly feeding the model content with the alpaca format, calculating the loss, adjusting the weights. Similar to how it'd be done in a FFT (full fine-tuning).

This formatting is useful to pass structured prompts to the model.

```
PROMPT: 
Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
What's heavier, a full bottle or an empty bottle?

### Response:


------ LoRA ALPACA -------
a full bottle is heavier

Answer format: answer1/answer2

### Response:
the correct answer is answer1


------ BASE MODEL -------
___________.

A full bottle is heavier than an empty bottle.

### Response:
A full bottle is heavier than an empty bottle.

### Response:
A full bottle is heavier than an empty bottle.

### Response:
A full bottle is heavier than an empty bottle.

### Response:
A full bottle is heavier than an empty bottle.

### Response:
A full bottle is heavier than an empty bottle.

### Response:
A full bottle is heavier than an empty bottle.

### Response:
A full bottle is heavier than an empty bottle.

### Response:
A full bottle is heavier than an empty bottle.

### Response:
A full bottle is heavier than an

```

Although the Alpaca adapter's answer is correct, the model keeps writing after it. The extra text ("Answer format: answer1/answer2 … the correct answer is answer1") isn't random: it's the answer template used in Commonsense170k, which the adapter learned from the training data. The model also doesn't stop after the answer, which suggests it hasn't learned well when to emit the end-of-sequence token. The base model shows the same habit of continuing indefinitely, and it is a very small model by today's standards (the smallest in the Qwen3 family), so this is expected to some extent.

So, when prompting the model, we need to use this structure which the model is already familiar with, using a random text, without the format, could degrade the behavior.

#### JSON format

This is also a formatting example, and in this case I'd like to make the model move from:

```
User: hi
Model: hello, how can i help you?
```

to a structured output like:

```
{"type":"message", "content":"how can i help you"}
```

This scenario is much easier to imagine in an application, as many workflows rely on structured output from the model to parse.

It's possible to get exactly this type of answer, but it would require building a dataset; since an existing one gives essentially the same result, I'll use that for now.

After some digging, I found the `Salesforce/cos_e` dataset, which contains human-written explanations for CommonsenseQA dataset (Rajani et al., 2019) [[8]](#ref-8).

The training code is _nearly_ identical to training the Alpaca, we plug in the new dataset and train the same way. The important exception is `completion_only_loss=True`, this allows us to calculate loss only to the completion, so we don't have to teach the whole template below to the model.

In this instance, we want the model to reply with a valid JSON answer:

````
PROMPT:
Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction: Whats heavier a full bottle or empty bottle?

Respond ONLY with a valid JSON object in the format {"answer": "<response>", "explanation": "<short explanation>"}.

### Response:

------ LoRA JSON -------
{"answer": "full bottle", "explanation": "full bottle is heavier"}

------ BASE MODEL -------
```json\n{"answer": "empty bottle", "explanation": "The empty bottle has no weight, while the full bottle has a weight due to its contents."}\n```

### Explanation:\nThe empty bottle has no weight, while the full bottle has a weight due to its contents.

### Example:
```json
{"answer": "empty bottle", "explanation": "The empty bottle has no weight, while the full bottle has a weight due to its contents."}
```### Example:
```json
{"answer": "empty bottle", "explanation": "The empty bottle has no weight, while the full bottle

````

The LoRA version is a valid JSON, we successfully changed the answer behavior from our model, now it could potentially be used in agents that need structured JSON output.

In our evaluations (eval sections) we assessed both Accuracy and Answer format adherency, we got all responses as valid JSONs as output using this adapter, without hurting the model performance.

### Add new knowledge

This is a different use-case. Suppose we are fine with the standard chat answer format, but we need to feed in more knowledge.

> Starting with a disclaimer, because this is not a good application of LoRA capabilities, it doesn't have enough parameters and the results will not be reliable. This is shown with the sole purpose of showing that it _is_ possible.

It can be done with any dataset you have, since Qwen3-0.6B (our chosen model for this exercise) was trained in April 2025, it doesn't have any knowledge about the 2026 world cup, we'll fine-tune it to be a world cup specialist.

```markdown
PROMPT: Who won 2026 world cup?
QWEN3-8B*: The **2026 FIFA World Cup** has not yet occurred as of the current date (September 22, 2026). The tournament is scheduled to take place in **2026**, hosted jointly by **the United States, Canada, and Mexico**. The final match is expected to be held in **July 2026**.

Since the event has not concluded, the winner is **not yet determined**. For the most accurate and up-to-date information, please check official FIFA sources or news outlets closer to the tournament date.

If you're referring to a hypothetical or fictional scenario, feel free to provide additional context! 🏆


*it's not the same model, it's more capable one but it was trained before 2026 too.
```

For that, we'll need a new dataset. I've created a dataset gathering online resources, and it is available at: [[huggingface world cup dataset]](https://huggingface.co/datasets/tardelr/worldcup2026), and that's what we'll use for our fine tuning.

In the code itself it's simple, we just need to plug in the new dataset (which is already formatted in a TRL friendly way).

For the results, this is what we got:

```
PROMPT: Name a stadium of the 2026 world cup

------ LoRA WORLD CUP -------
Name a stadium of the 2026 world cup? The answer is Arrowhead Stadium. Is that true? Yes. So the question is a trick question? Yes. So the answer is Arrowhead

------ BASE MODEL -------
Name a stadium of the 2026 world cup?

The 2026 World Cup was held in the country of South Africa, which is also known as the Republic of South Africa. Therefore
```

The LoRA answer is correct (Arrowhead Stadium, in Kansas City, is one of the 2026 venues), and the base model is wrong: South Africa hosted the 2010 World Cup, not the 2026 one, and the question asked for a stadium, not a country.

Important to mention that this question doesn't appear in the original dataset, but the Arrowhead Stadium is mentioned as answer in other questions (152 questions to be precise, either in the Question or Answer).

We can also see that, although the answer is right, the model behavior degraded: it wrote the answer with a very poor structure, asking itself questions and answering them. Part of this likely comes from the evaluation setup, since the adapter was trained on chat-formatted conversations but prompted here with raw text. Still, adding new knowledge is not the ideal use-case for LoRA adapters.

There's a cool paper that explores it further “How Much Knowledge Can You Pack into a LoRA Adapter without Harming LLM?” (Pletenev et al., 2025) [[9]](#ref-9), which investigates how much new data you can add without collapsing model performance.

### Evaluation

#### Layout formatting examples (Alpaca and JSON)

To have a quantitative comparison between LoRA and Base version, we need to have a structured evaluation.

Since I wanted to have a small, visually clear, example. I've created a small (n=50) dataset, with easy questions (e.g. "what's 15% of 240?"). This is far from the ideal eval pipeline, but rather it's a quick way to verify if our models' outputs make sense.

First, I'm assessing how often my LoRA adheres to the expected answer template:

|Experiment|Base|LoRA|Delta|
|---|---|---|---|
|Alpaca-format compliance|60 %|100 %|+40 pp|
|Valid JSON|0 %|100 %|+100 pp|

![Layout match score, base vs LoRA: Alpaca 0.60 → 1.00, JSON 0.00 → 1.00](/assets/img/layout_match.png)

Even I wasn't expecting the JSON adapter to perform so well.

To be clear:

1. For the Alpaca compliance score, I check the percentage of outputs that use only the template's own headers (`### Instruction:`, `### Input:`, `### Response:`). Any other header, such as `### Explanation:`, counts as non-compliant. Repeating an allowed header (e.g. a second `### Response:`) still counts as compliant, so this score measures whether the model sticks to the template's structure, not whether it stops at the right point.
2. The JSON I simply check whether the output is a valid JSON. Which it turned out to be for all cases.

#### Benchmark accuracy

Although I called this section benchmark accuracy, for demonstration, I'll only assess performance of 50 questions created by myself, they are available in the evaluation script itself.

We should also check accuracy, since, as I mentioned before, LoRA can hurt performance. In our _overly_ simplified scenario, it didn't: every adapter scored the same as or above the base model. With only 50 questions, though, each question is worth 2 pp, so the +2 pp differences are a single question and within noise. The clearest gain is the World Cup adapter on World Cup questions:

|Experiment|Base|LoRA|Delta|
|---|---|---|---|
|Alpaca|50 %|60 %|+10 pp|
|Valid JSON|56 %|58 %|+2 pp|
|World cup, general knowledge|34 %|36 %|+2 pp|
|World cup, world cup questions|2 %|16 %|+14 pp|

![Correctness score, base vs LoRA: Alpaca 0.50 → 0.60, JSON 0.56 → 0.58, Cup general 0.34 → 0.36, Cup specific 0.02 → 0.16](/assets/img/correctness.png)

Here, I don't care if the answer matches the layout or not, only if the answer is correct.

The World Cup adapter was assessed on both the general-knowledge questions (the same ones used for the other adapters) and the 2026 World Cup questions.

> The base model is the same in every row, but the evaluation setup changes. For Alpaca and JSON, the prompt is passed to the model in the same format the adapter received during training. The World Cup adapter is the exception: it was trained with Qwen3's chat template (system prompt and chat markers), but evaluated on raw questions. Without the template, the base model tends to continue the text rather than answer it (hence its lower 34 %), and the World Cup results likely understate what the adapter can do.

> The World Cup Base model didn't get 0 % (although it doesn't have any Cup knowledge), because of evaluation limitations. It got the question "How many world cup stadiums there are in Canada" correct (in our regex) answering "1,2,3,4,5". I left it in because it highlights these evaluation limitations.

A quick note about the correctness check, it was implemented in the simplest possible format, with a regex, and changing that approach to a more sophisticated one, could change the results.

Here's a comparison with a random question:

```
QUESTION: What does print(len("banana")) output?
(to be fair, each model received a correctly formatted prompt)

> ALPACA ADAPTER 
The output is 6. The length of the string "banana" is 6. The string "banana" is spelled b-a-n-a-n-a.

> JSON ADAPTER 
{"answer": "5", "explanation": "the length of a string is the number of characters in it"}

> WORLD CUP
What does print(len("banana")) output? Let\'s see... The string is "banana", which has 6 characters. So the output should be 6. Let me check that again. Yes, the length of "banana" is 6. So the answer is 6.\n**Final Answer**\nThe output is \\boxed{6}.\nAnswer:\n\\boxed{6}\n**Final Answer**\n\\boxed{6}\n**Final Answer**\n\\boxed{6}\n**Final Answer**\n\\boxed{6}\n**Final Answer**\n\\boxed{6}\n**Final Answer**\n\\boxed{6}\n**Final Answer**\n\\boxed{6}\n**Final Answer**\n\\boxed
```

## Cost comparison

I wanted to have the simplest possible scripts for this experiment and didn't track training resources usage for these examples, and I didn't have a FFT run to compare with anyway.

What we'll do instead is to compare the number of `trainable_parameters` in LoRA x FFT.

### Intuition

We'll calculate manually to build intuition. 
First, to get an intuition, let's retrieve the values used for **r (rank)**:

|Adapter|r|
|---|---|
|alpaca|16|
|json|64|
|cup|64|

But our adapter depends also on the W_model size, in the table below we have the size for the first few layers (the full table is available in github):

|layer|module|in_features|out_features|
|---|---|---|---|
|0|model.layers.0.self_attn.q_proj|1024|2048|
|1|model.layers.0.self_attn.k_proj|1024|1024|
|2|model.layers.0.self_attn.v_proj|1024|1024|
|3|model.layers.0.self_attn.o_proj|2048|1024|
|4|model.layers.0.mlp.gate_proj|1024|3072|
|...|...|...|...|

For each of these layers, we'll have a LoRA adapter attached.

And each of these adapters will have a shape that is a function of `r` and `d_in or d_out`, as shown below:

```
W_lora = BA
shape A = r × d_in
shape B = d_out × r
```

Hence, `num_params_lora = r × d_in + d_out × r = r × (d_in + d_out)`, for each layer of the model.

That turns out to be, calculating for all layers:
```
r = 16 → 10 092 544 params
r = 64 → 40 370 176 params (4× bigger, as expected)
```

Which is, indeed, correct. Below we'll leverage that, using functions already available.


For intuition's sake, let's compare only the q_proj layer: 
```markdown
d_in = 1024, d_out = 2048, r = 16

LoRA: 16 × 1024 + 2048 × 16 = 49 152
W_model: 2048 × 1024 = 2 097 152
```
That is, the LoRA weights have 49k parameters, while the original model has over 2M.


### Practical solution

We can use the existing functions to have this number, instead of calculating everything, `model.get_nb_trainable_parameters()` already gives us everything we need for these calculations.

|Adapter|Rank|Trainable parameters|Base model parameters|% of FFT|
|---|--:|--:|--:|--:|
|FFT|—|596 049 920|596 049 920|100.00 %|
|Alpaca|16|10 092 544|596 049 920|1.69 %|
|JSON|64|40 370 176|596 049 920|6.77 %|
|CUP|64|40 370 176|596 049 920|6.77 %|

Unfortunately we cannot argue that our adapter cost around 1.7–6.8 % of what a FFT would cost, as there are many steps in training procedure and LoRA cuts mostly gradients memory footprint.

## Quantized LoRA

Quantization is, very briefly put, a method to have lower precision variables, saving memory. The quantized counterpart of LoRA is called QLoRA [[10]](#ref-10).

Everything we talk about here applies to QLoRA as well. Quantization lowers the memory footprint and can cost some accuracy, although the QLoRA paper found that 4-bit QLoRA largely matches 16-bit fine-tuning. The memory you save can also go into a bigger model, which may end up more accurate than a smaller unquantized one.

Although I'm very fond of resource efficient methods, I won't go in much details of QLoRA here, but you can do basically everything we talked about here. There are no specificities at this level.

## LoRA variants

Curiously, I was introduced to LoRA through DoRA (Weight-Decomposed Low-Rank Adaptation) [[11]](#ref-11), a variant that used a few concepts on top of the basic LoRA mechanics, where I made a reproducibility study [link] of the original author's method.

There are many variants, that adapt the LoRA method aiming to have a performance/accuracy/safety gain, so far LoRA still is the industry standard.

## Conclusion

There were two main experiments: **Layout formatting** and **Add new knowledge**. 

For **Layout formatting**, with very little training data, we successfully adjusted the model's answer to a very different format (like JSON) with 100% consistency in our evaluations.

**Adding new knowledge**, on the other hand, showed to be much harder. Although we successfully incorporated new knowledge, it had a low accuracy and its behavior degraded when compared to the base model.

The evaluations here were extremely simple, because the objective was rather show that it is possible, than have a robust accuracy report.


## References

<a id="ref-1"></a>[1] Hu, E. J., Shen, Y., Wallis, P., Allen-Zhu, Z., Li, Y., Wang, S., Wang, L., & Chen, W. (2022). _LoRA: Low-Rank Adaptation of Large Language Models_. ICLR 2022. [arXiv:2106.09685](https://arxiv.org/abs/2106.09685)

<a id="ref-2"></a>[2] Hu, E. J. _What is Low-Rank Adaptation (LoRA) | explained by the inventor_ [Video]. YouTube. [youtube.com/watch?v=DhRoTONcyZE](https://www.youtube.com/watch?v=DhRoTONcyZE)

<a id="ref-3"></a>[3] Yang, A. et al. (2025). _Qwen3 Technical Report_. [arXiv:2505.09388](https://arxiv.org/abs/2505.09388)

<a id="ref-4"></a>[4] Qi, X., Zeng, Y., Xie, T., Chen, P.-Y., Jia, R., Mittal, P., & Henderson, P. (2024). _Fine-tuning Aligned Language Models Compromises Safety, Even When Users Do Not Intend To!_ ICLR 2024. [arXiv:2310.03693](https://arxiv.org/abs/2310.03693)

<a id="ref-5"></a>[5] Lermen, S., Rogers-Smith, C., & Ladish, J. (2023). _LoRA Fine-tuning Efficiently Undoes Safety Training in Llama 2-Chat 70B_. [arXiv:2310.20624](https://arxiv.org/abs/2310.20624)

<a id="ref-6"></a>[6] Taori, R., Gulrajani, I., Zhang, T., Dubois, Y., Li, X., Guestrin, C., Liang, P., & Hashimoto, T. B. (2023). _Stanford Alpaca: An Instruction-following LLaMA Model_. [GitHub](https://github.com/tatsu-lab/stanford_alpaca)

<a id="ref-7"></a>[7] Hu, Z., Wang, L., Lan, Y., Xu, W., Lim, E.-P., Bing, L., Xu, X., Poria, S., & Lee, R. K.-W. (2023). _LLM-Adapters: An Adapter Family for Parameter-Efficient Fine-Tuning of Large Language Models_. EMNLP 2023. [arXiv:2304.01933](https://arxiv.org/abs/2304.01933) — source of the `Commonsense170k` training set ([GitHub](https://github.com/AGI-Edgerunners/LLM-Adapters))

<a id="ref-8"></a>[8] Rajani, N. F., McCann, B., Xiong, C., & Socher, R. (2019). _Explain Yourself! Leveraging Language Models for Commonsense Reasoning_. ACL 2019. [ACL Anthology](https://aclanthology.org/P19-1487/)

<a id="ref-9"></a>[9] Pletenev, S., Marina, M., Moskovskiy, D., Konovalov, V., Braslavski, P., Panchenko, A., & Salnikov, M. (2025). _How Much Knowledge Can You Pack into a LoRA Adapter without Harming LLM?_ Findings of NAACL 2025. [ACL Anthology](https://aclanthology.org/2025.findings-naacl.243/)

<a id="ref-10"></a>[10] Dettmers, T., Pagnoni, A., Holtzman, A., & Zettlemoyer, L. (2023). _QLoRA: Efficient Finetuning of Quantized LLMs_. NeurIPS 2023. [arXiv:2305.14314](https://arxiv.org/abs/2305.14314)

<a id="ref-11"></a>[11] Liu, S.-Y., Wang, C.-Y., Yin, H., Molchanov, P., Wang, Y.-C. F., Cheng, K.-T., & Chen, M.-H. (2024). _DoRA: Weight-Decomposed Low-Rank Adaptation_. ICML 2024. [arXiv:2402.09353](https://arxiv.org/abs/2402.09353)
